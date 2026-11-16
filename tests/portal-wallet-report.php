<?php
declare(strict_types=1);

$p = '/api/reports/portal-wallet';
$m = 'GET';
$role = 'finance';
$state = [
    'customers' => [['id' => 1, 'name' => 'مشتری', 'mobile' => 'private'], ['id' => 2, 'deleted' => true]],
    'customer_wallet' => [1 => [['amount' => 900]], 2 => [['amount' => 8000]]],
    'orders' => [['id' => 10, 'customer_id' => 1, 'approval_status' => 'در انتظار تأیید', 'credit_checkout' => ['wallet_reserved' => 200]]],
];

/** Capture the production handler's terminating responses. */
final class PortalWalletResponse extends RuntimeException
{
    public ?array $payload;
    public function __construct(int $status, ?array $payload)
    {
        parent::__construct('Fixture response', $status);
        $this->payload = $payload;
    }
}

/** Apply the same staff role check without an application session. */
function auth(array $roles): void
{
    if (!in_array($GLOBALS['role'], $roles, true)) fail('Forbidden', 403);
}
/** Run the route against the fixture and disallow writes. */
function db(bool $write, callable $read): ?array
{
    if ($write) throw new LogicException('Expected a read-only route.');
    return $read($GLOBALS['state']);
}
/** Capture successful JSON output. */
function out(array $value): void { throw new PortalWalletResponse(200, $value); }
/** Capture a rejected request. */
function fail(string $message, int $status): void { throw new PortalWalletResponse($status, null); }
/** Exercise the same include boundary as the web router. */
function walletReportRequest(string $roleName, array $query, int $status): ?array
{
    global $p, $m, $role;
    $role = $roleName;
    $_GET = $query;
    try {
        require __DIR__.'/../lib/portal-wallet-report-route.php';
    } catch (PortalWalletResponse $response) {
        if ($response->getCode() !== $status) throw $response;
        return $response->payload;
    }
    throw new LogicException('Expected a response.');
}

$customers = walletReportRequest('finance', [], 200);
if ($customers !== [['id' => 1, 'name' => 'مشتری', 'company' => '', 'code' => '']]) {
    throw new LogicException('Customer selector disclosed excess fields or deleted accounts.');
}
$wallet = walletReportRequest('admin', ['customer_id' => '1'], 200);
if ($wallet['balance'] !== 900 || $wallet['reserved'] !== 200 || $wallet['available'] !== 700) {
    throw new LogicException('Wallet does not reconcile.');
}
walletReportRequest('finance', ['customer_id' => '2'], 404);
walletReportRequest('finance', ['customer_id' => ['1']], 422);
walletReportRequest('sales', ['customer_id' => '1'], 403);
walletReportRequest('customer', ['customer_id' => '1'], 403);
echo "Portal wallet roles, customer isolation and funds verified.\n";
