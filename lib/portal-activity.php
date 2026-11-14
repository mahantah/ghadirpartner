<?php
declare(strict_types=1);

/** Track daily customer activity independently of the orders and inventory state. */
final class GpPortalActivity
{
    private PDO $pdo;
    private array $policy;
    private DateTimeZone $zone;

    /** Use the established portal database and validated reporting policy. */
    public function __construct(PDO $pdo, array $policy)
    {
        foreach (['heartbeat_seconds', 'online_seconds', 'abandoned_seconds', 'history_days', 'max_products', 'max_quantity'] as $key) {
            if (!is_int($policy[$key] ?? null) || $policy[$key] <= 0) {
                throw new RuntimeException('Invalid portal activity policy.');
            }
        }
        $this->pdo = $pdo;
        $this->policy = $policy;
        $this->zone = new DateTimeZone($policy['timezone']);
    }

    /** Prepare the separate indexed table before a release is exposed to customers. */
    public function install(): void
    {
        $this->pdo->exec('CREATE TABLE IF NOT EXISTS gp_portal_activity (
            customer_id BIGINT UNSIGNED NOT NULL,
            channel VARCHAR(8) NOT NULL,
            day DATE NOT NULL,
            seen_at BIGINT UNSIGNED NOT NULL,
            cart_at BIGINT UNSIGNED NOT NULL DEFAULT 0,
            cart TEXT NOT NULL,
            selected TEXT NOT NULL,
            PRIMARY KEY (customer_id, channel, day),
            KEY day_seen (day, seen_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
    }

    /** Validate cart input and retain only product names and aggregate quantities. */
    public static function quantities(array $lines, int $maxProducts, int $maxQuantity): array
    {
        if (count($lines) > $maxProducts) {
            throw new InvalidArgumentException('تعداد ردیف‌های سبد بیش از حد مجاز است.');
        }
        $result = [];
        foreach ($lines as $line) {
            if (!is_array($line)) {
                throw new InvalidArgumentException('ردیف سبد معتبر نیست.');
            }
            $name = $line['product'] ?? null;
            $qty = $line['qty'] ?? null;
            if (!is_string($name) || trim($name) === '' || strlen($name) > 240 ||
                !is_int($qty) || $qty < 1 || $qty > $maxQuantity) {
                throw new InvalidArgumentException('کالا یا تعداد انتخابی معتبر نیست.');
            }
            $result[$name] = min($maxQuantity, ($result[$name] ?? 0) + $qty);
        }
        ksort($result);
        return $result;
    }

    /** Accept a foreground signal, a full cart snapshot, or a clear for this channel. */
    public function record(int $customerId, string $channel, ?array $lines, int $now): void
    {
        if (!in_array($channel, ['web', 'android'], true)) {
            throw new InvalidArgumentException('مسیر فعالیت معتبر نیست.');
        }
        $cart = $lines === null ? null : self::quantities($lines, $this->policy['max_products'], $this->policy['max_quantity']);
        $day = $this->localDate($now);
        $summary = $this->pdo->prepare('SELECT seen_at,cart FROM gp_portal_activity WHERE customer_id=? AND channel=? AND day=?');
        $key = [$customerId, $channel, $day];
        $summary->execute($key);
        $existing = $summary->fetch();
        if ($existing && $now - (int) $existing['seen_at'] < $this->policy['heartbeat_seconds'] &&
            ($cart === null || json_decode($existing['cart'], true, 512, JSON_THROW_ON_ERROR) === $cart)) {
            return;
        }
        $this->pdo->beginTransaction();
        try {
            $seed = $this->pdo->prepare("INSERT INTO gp_portal_activity (customer_id,channel,day,seen_at,cart,selected)
                VALUES (?,?,?,0,'[]','[]') ON DUPLICATE KEY UPDATE seen_at=seen_at");
            $seed->execute($key);
            $locked = $this->pdo->prepare('SELECT * FROM gp_portal_activity WHERE customer_id=? AND channel=? AND day=? FOR UPDATE');
            $locked->execute($key);
            $row = $locked->fetch();
            $stored = json_decode($row['cart'], true, 512, JSON_THROW_ON_ERROR);
            $selected = json_decode($row['selected'], true, 512, JSON_THROW_ON_ERROR);
            $cartAt = (int) $row['cart_at'];
            if ($cart !== null && $cart !== $stored && $now >= $cartAt) {
                foreach ($cart as $product => $quantity) {
                    $selected[$product] = max($selected[$product] ?? 0, $quantity);
                }
                $stored = $cart;
                $cartAt = $now;
            }
            $update = $this->pdo->prepare('UPDATE gp_portal_activity SET seen_at=?,cart_at=?,cart=?,selected=? WHERE customer_id=? AND channel=? AND day=?');
            $update->execute(array_merge([
                max($now, (int) $row['seen_at']), $cartAt, json_encode($stored, JSON_THROW_ON_ERROR),
                json_encode($selected, JSON_THROW_ON_ERROR),
            ], $key));
            $this->pdo->commit();
        } catch (Throwable $error) {
            $this->pdo->rollBack();
            throw $error;
        }
    }

    /** Summarize customers over the configured history window and expire carts at Tehran midnight. */
    public function report(int $now): array
    {
        $today = $this->localDate($now);
        $cutoff = (new DateTimeImmutable($today, $this->zone))->modify('-'.($this->policy['history_days'] - 1).' days')->format('Y-m-d');
        $prune = $this->pdo->prepare('DELETE FROM gp_portal_activity WHERE day<? LIMIT 500');
        $prune->execute([$cutoff]);
        $expire = $this->pdo->prepare("UPDATE gp_portal_activity SET cart='[]',cart_at=0 WHERE day<? AND cart_at>0 LIMIT 500");
        $expire->execute([$today]);
        $query = $this->pdo->prepare('SELECT * FROM gp_portal_activity WHERE day>=? ORDER BY day DESC');
        $query->execute([$cutoff]);
        $customers = [];
        while ($row = $query->fetch()) {
            $id = (int) $row['customer_id'];
            $summary = $customers[$id] ?? ['customer_id' => $id, 'last_seen' => 0, 'online' => false, 'carts' => [], 'selected' => []];
            $summary['last_seen'] = max($summary['last_seen'], (int) $row['seen_at']);
            $summary['online'] = $now - $summary['last_seen'] <= $this->policy['online_seconds'];
            foreach (json_decode($row['selected'], true, 512, JSON_THROW_ON_ERROR) as $product => $qty) {
                $summary['selected'][$product] = ($summary['selected'][$product] ?? 0) + $qty;
            }
            if ($row['day'] === $today && (int) $row['cart_at'] > 0) {
                $cart = json_decode($row['cart'], true, 512, JSON_THROW_ON_ERROR);
                if ($cart) {
                    $summary['carts'][] = [
                        'channel' => $row['channel'], 'products' => $cart,
                        'abandoned' => $now - (int) $row['cart_at'] >= $this->policy['abandoned_seconds'],
                        'updated_at' => (int) $row['cart_at'],
                    ];
                }
            }
            $customers[$id] = $summary;
        }
        return ['history_days' => $this->policy['history_days'], 'customers' => array_values($customers)];
    }

    /** Use the business day even when clients use a different time zone. */
    private function localDate(int $now): string
    {
        return (new DateTimeImmutable('@'.$now))->setTimezone($this->zone)->format('Y-m-d');
    }
}
