<?php
declare(strict_types=1);

$p = '/api/reports/portal-wallet';
$role = 'finance';
$state = [
    'customers' => [['id' => 1, 'name' => 'مشتری یک', 'code' => 'GP-123', 'mobile' => '09121234567'], ['id' => 2, 'mobile' => '09129999999', 'deleted' => true]],
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
function auth(array $roles): array
{
    if (!in_array($GLOBALS['role'], $roles, true)) fail('Forbidden', 403);
    return ['id' => 17];
}
/** Commit fixture updates only when the database callback returns successfully. */
function db(bool $write, callable $callback): array
{
    $snapshot = $GLOBALS['state'];
    $result = $callback($snapshot);
    if ($write) $GLOBALS['state'] = $snapshot;
    return $result;
}
/** Return the fixture's JSON body. */
function input(): array { return $GLOBALS['walletBody']; }
/** Supply a stable transaction timestamp. */
function now(): string { return '2026-11-16 10:00:00'; }
/** Capture successful JSON output. */
function out(array $value): void { throw new PortalWalletResponse(200, $value); }
/** Capture a rejected request. */
function fail(string $message, int $status): void { throw new PortalWalletResponse($status, null); }
/** Exercise the same include boundary as the web router. */
function walletReportRequest(string $roleName, array $query, int $status, ?array $body = null, string $contentType = 'application/json'): ?array
{
    global $p, $role;
    $role = $roleName;
    $m = $body === null ? 'GET' : 'POST';
    $GLOBALS['walletBody'] = $body;
    $_SERVER['CONTENT_TYPE'] = $contentType;
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
if ($customers !== [['id' => 1, 'name' => 'مشتری یک', 'company' => '', 'code' => 'GP-123']]) {
    throw new LogicException('Customer selector disclosed excess fields or deleted accounts.');
}
foreach (['مشتري', 'gp-۱۲۳', '۰۹۱۲۱۲۳۴۵۶۷'] as $query) {
    if (walletReportRequest('finance', ['q' => $query], 200) !== $customers) {
        throw new LogicException('Wallet selector did not match the requested customer search field.');
    }
}
if (walletReportRequest('finance', ['q' => '09129999999'], 200) !== []) {
    throw new LogicException('Search included a deleted customer.');
}
walletReportRequest('sales', ['q' => '09121234567'], 403);
walletReportRequest('finance', ['q' => []], 422);
$wallet = walletReportRequest('admin', ['customer_id' => '1'], 200);
if ($wallet['balance'] !== 900 || $wallet['reserved'] !== 200 || $wallet['available'] !== 700) {
    throw new LogicException('Wallet does not reconcile.');
}
walletReportRequest('finance', ['customer_id' => '2'], 404);
walletReportRequest('finance', ['customer_id' => ['1']], 422);
walletReportRequest('sales', ['customer_id' => '1'], 403);
walletReportRequest('customer', ['customer_id' => '1'], 403);

$credit = ['customer_id' => 1, 'amount' => 150, 'note' => 'واریز تأییدشده', 'request_id' => str_repeat('a', 32)];
walletReportRequest('sales', [], 403, $credit);
walletReportRequest('customer', [], 403, $credit);
walletReportRequest('finance', [], 415, $credit, 'text/plain');
walletReportRequest('finance', [], 404, array_replace($credit, ['customer_id' => 2]));
walletReportRequest('finance', [], 422, array_replace($credit, ['amount' => -1]));
walletReportRequest('finance', [], 422, array_replace($credit, ['amount' => 1000000000001]));
walletReportRequest('finance', [], 422, array_replace($credit, ['note' => ' ']));
walletReportRequest('finance', [], 422, array_replace($credit, ['request_id' => 'invalid']));
$updated = walletReportRequest('finance', [], 200, $credit);
$repeat = walletReportRequest('finance', [], 200, $credit);
walletReportRequest('finance', [], 409, array_replace($credit, ['amount' => 151]));
$readAgain = walletReportRequest('admin', ['customer_id' => '1'], 200);
$movement = $readAgain['transactions'][0];
if ($updated !== $repeat || $updated !== $readAgain || $updated['balance'] !== 1050
    || $updated['reserved'] !== 200 || $updated['available'] !== 850 || count($updated['transactions']) !== 2
    || $movement['note'] !== $credit['note'] || $movement['actor_id'] !== 17 || $movement['at'] !== now()
    || $movement['source'] !== 'manual_credit' || $state['customer_wallet'][2] !== [['amount' => 8000]]) {
    throw new LogicException('Manual credit did not commit exactly once to the correct wallet.');
}
$customerWallet = (new GpOrderWallet())->read($state, 1);
if ($customerWallet['balance'] !== 1050
    || array_key_exists('note', $customerWallet['transactions'][0]) || array_key_exists('actor_id', $customerWallet['transactions'][0])) {
    throw new LogicException('Customer wallet omitted the credit or disclosed staff audit fields.');
}
$withdrawal = ['request_id' => str_repeat('b', 32), 'amount' => 100, 'destination' => 'IR'.str_repeat('1', 24)];
$validIban = 'IR220000000000000000000001';
(new GpPortalAccount())->saveBank($state, 1, ['iban' => $validIban, 'bank_name' => 'بانک آزمایشی']);
$service = new GpOrderWallet();
$service->requestRefund($state, 1, $withdrawal, now(), ['max_amount' => 1000]);
$service->requestRefund($state, 1, $withdrawal, now(), ['max_amount' => 1000]);
$scope = ['refunds' => '1'];
walletReportRequest('sales', $scope, 403);
walletReportRequest('customer', $scope, 403);
$queue = walletReportRequest('finance', $scope, 200);
if (count($queue) !== 1 || $queue[0]['status'] !== 'pending' || $queue[0]['destination'] !== $validIban || $queue[0]['bank_name'] !== 'بانک آزمایشی'
    || isset($service->refundRequests($state, 1)[0]['destination'])
    || $service->refundRequests($state, 2) !== [] || $service->read($state, 1)['balance'] !== 1050) {
    throw new LogicException('Refund queue, isolation or pending balance is incorrect.');
}
$review = ['customer_id' => 1, 'request_id' => $withdrawal['request_id'], 'kind' => 'wallet', 'action' => 'approve'];
walletReportRequest('finance', $scope, 200, $review);
walletReportRequest('finance', $scope, 200, $review);
$paid = array_replace($review, ['action' => 'paid', 'reference' => 'TEST-REF']);
$final = walletReportRequest('finance', $scope, 200, $paid);
if ($final[0]['status'] !== 'paid' || $final[0]['reference'] !== 'TEST-REF' || $service->read($state, 1)['balance'] !== 950) {
    throw new LogicException('Refund was not debited once or payment reference was lost.');
}
$accounts = new GpPortalAccount();
function clean_mobile(string $value): string { return preg_replace('/[^0-9]/', '', $value); }
$state['users'] = [
    ['id' => 8, 'roles' => ['customer'], 'active' => true, 'customer_id' => 1],
    ['id' => 9, 'roles' => ['customer'], 'active' => true, 'customer_id' => 2],
];
$state['next_user'] = 10;
if ($accounts->ownerId($state, 8) !== 1) throw new LogicException('Wrong account owner.');
$extra = $accounts->addDelegate($state, 8, 1, 'همکار آزمایشی', '09121111111', 'FixturePassword');
if ($state['users'][2]['customer_id'] !== 1 || !password_verify('FixturePassword', $state['users'][2]['password_hash'])
    || $accounts->delegates($state, 2) !== [] || isset($extra['password_hash'])) {
    throw new LogicException('Delegate scoping, credentials or public projection is incorrect.');
}
try {
    $accounts->ownerId($state, $extra['id']);
    throw new LogicException('A delegate was allowed to administer the account.');
} catch (DomainException $error) {
    if ($error->getCode() !== 403) throw $error;
}
try {
    $accounts->revoke($state, 2, $extra['id']);
    throw new LogicException('An unrelated owner was allowed to revoke a delegate.');
} catch (DomainException $error) {
    if ($error->getCode() !== 404) throw $error;
}
$accounts->revoke($state, 1, $extra['id']);
if ($accounts->delegates($state, 1) !== [] || $state['users'][2]['active']) {
    throw new LogicException('Delegate access was not disabled.');
}

echo "Portal wallet roles, refunds, customer isolation, manual credit and safe retries verified.\n";
