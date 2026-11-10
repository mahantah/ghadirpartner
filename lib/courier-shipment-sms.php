<?php

declare(strict_types=1);

/** Validated message labels and the existing shipment notification scope. */
final class CourierShipmentSmsPolicy
{
    public string $kind;
    public string $carrier;
    public string $nameLabel;
    public string $phoneLabel;
    public string $separator;

    /** @param array<string, mixed> $settings Reviewed message configuration. */
    public function __construct(array $settings)
    {
        $this->kind = $this->required($settings, 'kind');
        $this->carrier = $this->required($settings, 'carrier');
        $this->nameLabel = $this->required($settings, 'name_label');
        $this->phoneLabel = $this->required($settings, 'phone_label');
        $this->separator = $this->required($settings, 'separator');
        if ($this->kind !== 'shipped' || $this->carrier !== 'پیک') {
            throw new InvalidArgumentException('invalid_courier_sms_scope');
        }
    }

    /** @param array<string, mixed> $settings Require strings without implicit casts. */
    private function required(array $settings, string $key): string
    {
        $value = $settings[$key] ?? null;
        if (!is_string($value) || $value === '') {
            throw new InvalidArgumentException('invalid_courier_sms_policy');
        }
        return $value;
    }
}

/** Facade for courier template variables and final outbound message enrichment. */
final class CourierShipmentSms
{
    private CourierShipmentSmsPolicy $policy;

    /** Inject validated labels; formatting never reads storage or sends a message. */
    public function __construct(CourierShipmentSmsPolicy $policy)
    {
        $this->policy = $policy;
    }

    /**
     * Expose courier fields only for courier shipments, avoiding stale carrier data.
     *
     * @param array<string, mixed> $order Existing saved order fields.
     * @return array<string, string> Variables available to saved or default templates.
     */
    public function variables(array $order): array
    {
        $name = '';
        $phone = '';
        if ($this->field($order, 'shipping_type') === $this->policy->carrier) {
            $name = $this->field($order, 'courier_name');
            $phone = $this->field($order, 'courier_phone');
        }
        $parts = [];
        if ($name !== '') {
            $parts[] = $this->policy->nameLabel . ': ' . $name;
        }
        if ($phone !== '') {
            $parts[] = $this->policy->phoneLabel . ': ' . $phone;
        }
        return [
            'courier_name' => $name,
            'courier_phone' => $phone,
            'courier_suffix' =>
                $parts === []
                    ? ''
                    : $this->policy->separator .
                        implode($this->policy->separator, $parts),
        ];
    }

    /**
     * Append missing courier details after rendering, including older saved templates.
     *
     * @param array<string, mixed> $variables Existing rendered-template variables.
     */
    public function enrich(
        string $kind,
        string $message,
        array $variables
    ): string {
        if (
            $kind !== $this->policy->kind ||
            $this->field($variables, 'carrier') !== $this->policy->carrier
        ) {
            return $message;
        }
        foreach (
            [
                'courier_name' => $this->policy->nameLabel,
                'courier_phone' => $this->policy->phoneLabel,
            ]
            as $key => $label
        ) {
            $value = $this->field($variables, $key);
            if ($value !== '' && strpos($message, $value) === false) {
                $message .= $this->policy->separator . $label . ': ' . $value;
            }
        }
        return $message;
    }

    /** @param array<string, mixed> $fields Ignore malformed values without warnings. */
    private function field(array $fields, string $key): string
    {
        $value = $fields[$key] ?? null;
        return is_string($value) ? trim($value) : '';
    }
}
