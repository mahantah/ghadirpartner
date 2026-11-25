<?php
declare(strict_types=1);

/** Manage customer-owned payout destinations and separately authenticated additional users. */
final class GpPortalAccount
{
    /** Authorize account administration using the current user record under the state lock. */
    public function ownerId(array $state, int $userId): int
    {
        foreach ($state['users'] ?? [] as $user) {
            if ((int) $user['id'] !== $userId) continue;
            $customerId = (int) ($user['customer_id'] ?? 0);
            if (!empty($user['active']) && $customerId > 0
                && ($user['roles'] ?? []) === ['customer'] && empty($user['portal_delegate_owner'])) {
                foreach ($state['customers'] ?? [] as $customer) {
                    if ((int) $customer['id'] === $customerId && empty($customer['deleted'])) return $customerId;
                }
            }
            break;
        }
        throw new DomainException('فقط صاحب حساب به این قسمت دسترسی دارد.', 403);
    }

    /** Read a payout destination without returning other customer data. */
    public function bank(array $state, int $customerId): array
    {
        return $state['portal_account_banks'][$customerId] ?? ['iban' => '', 'bank_name' => ''];
    }

    /** Update the payout destination with both fields validated before writing. */
    public function saveBank(array &$state, int $customerId, array $input): array
    {
        $iban = $input['iban'] ?? null;
        $bank = $input['bank_name'] ?? null;
        if (!is_string($iban) || !$this->validIban($iban)) {
            throw new DomainException('شماره شبای واردشده معتبر نیست.', 422);
        }
        if (!is_string($bank) || trim($bank) === '' || strlen($bank) > 240) {
            throw new DomainException('نام بانک را وارد کنید.', 422);
        }
        return $state['portal_account_banks'][$customerId] = ['iban' => $iban, 'bank_name' => trim($bank)];
    }

    private function validIban(string $iban): bool
    {
        if (!preg_match('/^IR[0-9]{24}$/D', $iban)) return false;
        $digits = substr($iban, 4).'1827'.substr($iban, 2, 2);
        $remainder = 0;
        foreach (str_split($digits) as $digit) $remainder = ($remainder * 10 + (int) $digit) % 97;
        return $remainder === 1;
    }

    /** Check method and path against the capabilities granted to a scoped delegate. */
    public function assertDelegateRoute(array $actor, string $method, string $path, array $body = []): void
    {
        $level = $actor['portal_access_level'] ?? null;
        if (empty($actor['portal_delegate_owner']) || $level === null) return;
        $commonReads = ['/api/me', '/api/native/account-access', '/api/catalog', '/api/products',
            '/api/offers', '/api/orders', '/api/notifications', '/api/native/panel-switches'];
        $salesReads = ['/api/addresses', '/api/customers', '/api/native/credit', '/api/orders/irankish'];
        $financeReads = ['/api/native/credit', '/api/order-followup', '/api/order-followup/document',
            '/api/reports/customer-summary', '/api/orders/irankish'];
        if ($path === '/api/logout' || ($method === 'POST' && in_array($path, ['/api/password', '/api/notifications/read', '/api/portal-activity'], true))) return;
        if ($method === 'GET' && (in_array($path, $commonReads, true)
            || ($level === 'sales' && in_array($path, $salesReads, true))
            || ($level === 'finance' && in_array($path, $financeReads, true)))) return;
        if ($method === 'POST' && $level === 'sales' && $path === '/api/addresses') return;
        if ($method === 'POST' && $level === 'sales' && $path === '/api/orders/add') {
            $terms = $body['settlement_details'] ?? [];
            if (is_array($terms) && in_array($body['requested_payment_method'] ?? '', ['cash', 'check', 'mixed'], true)
                && empty($body['online_checkout_mode']) && empty($body['online_checkout_id'])
                && empty($terms['cash_online']) && empty($terms['cash_online_amount'])
                && empty($terms['credit_amount']) && empty($terms['credit_enabled'])
                && empty($terms['wallet_amount']) && empty($terms['wallet_enabled'])) return;
        }
        if ($method === 'POST' && $level === 'finance' && $path === '/api/order-followup'
            && ($body['action'] ?? '') === 'submit' && !array_key_exists('wallet_amount', $body)) return;
        throw new DomainException('این عملیات در سطح دسترسی شما مجاز نیست.', 403);
    }

    /** List active delegates with a projection that excludes credentials. */
    public function delegates(array $state, int $customerId): array
    {
        $rows = [];
        foreach ($state['users'] ?? [] as $user) {
            if ((int) ($user['customer_id'] ?? 0) !== $customerId || empty($user['portal_delegate_owner']) || empty($user['active'])) continue;
            $rows[] = ['id' => (int) $user['id'], 'name' => $user['portal_delegate_name'], 'mobile' => $user['login_mobile'], 'access_level' => $user['portal_access_level'] ?? 'legacy'];
        }
        return $rows;
    }

    /** Check whether enrollment would collide with an existing identity. */
    public function assertAvailable(array $state, string $mobile): void
    {
        foreach ($state['users'] ?? [] as $user) {
            foreach (['username', 'login_mobile', 'alternate_mobile'] as $field) {
                if (clean_mobile($user[$field] ?? '') === $mobile) {
                    throw new DomainException('این شماره قبلاً به یک حساب اختصاص یافته است.', 409);
                }
            }
        }
        foreach ($state['customers'] ?? [] as $customer) {
            if (empty($customer['deleted']) && clean_mobile($customer['mobile'] ?? '') === $mobile) {
                throw new DomainException('این شماره قبلاً به یک حساب اختصاص یافته است.', 409);
            }
        }
        foreach ($state['registration_requests'] ?? [] as $request) {
            if (($request['status'] ?? 'pending') === 'pending' && clean_mobile($request['mobile'] ?? '') === $mobile) {
                throw new DomainException('درخواست عضویت برای این شماره در حال بررسی است.', 409);
            }
        }
    }

    /** Create a regular customer identity after the route verifies the scoped SMS challenge. */
    public function addDelegate(array &$state, int $ownerId, int $customerId, string $name, string $mobile, string $password, string $access = 'viewer'): array
    {
        if (!in_array($access, ['viewer', 'sales', 'finance'], true)) {
            throw new DomainException('سطح دسترسی معتبر نیست.', 422);
        }
        $this->assertAvailable($state, $mobile);
        $id = (int) $state['next_user']++;
        $state['users'][] = [
            'id' => $id, 'username' => $mobile, 'login_mobile' => $mobile, 'alternate_mobile' => '',
            'password_hash' => password_hash($password, PASSWORD_DEFAULT), 'roles' => ['customer'],
            'active' => true, 'customer_id' => $customerId, 'portal_delegate_owner' => $ownerId,
            'portal_delegate_name' => $name, 'portal_access_level' => $access,
        ];
        return ['id' => $id, 'name' => $name, 'mobile' => $mobile, 'access_level' => $access];
    }

    /** Disable a delegate without deleting the actor associated with historical records. */
    public function revoke(array &$state, int $customerId, int $delegateId): void
    {
        foreach ($state['users'] as &$user) {
            if ((int) $user['id'] === $delegateId && (int) ($user['customer_id'] ?? 0) === $customerId
                && !empty($user['portal_delegate_owner'])) {
                $user['active'] = false;
                return;
            }
        }
        throw new DomainException('کاربر این حساب پیدا نشد.', 404);
    }
}
