<?php
declare(strict_types=1);

/** Resolve customer panel choices against the automation's published options. */
final class GpPortalPanelSwitches
{
    private array $options;

    /** Use the validated options extracted from the automation form during release. */
    public function __construct(array $options)
    {
        if (!$options || array_values($options) !== $options) {
            throw new RuntimeException('Invalid panel switch list.');
        }
        foreach ($options as $option) {
            if (!is_string($option) || trim($option) === '' || strlen($option) > 120) {
                throw new RuntimeException('Invalid panel switch label.');
            }
        }
        $this->options = $options;
    }

    /** Load the same ordered choices used by the staff order form. */
    public static function published(): self
    {
        return new self(json_decode(
            (string) file_get_contents(dirname(__DIR__).'/config/portal-panel-switches.yaml'),
            true,
            512,
            JSON_THROW_ON_ERROR
        ));
    }

    /** Return the display labels in automation order. */
    public function options(): array
    {
        return $this->options;
    }

    /** Expose switch choices only for explicitly enabled product models. */
    public function productOptions(array $products): array
    {
        $choices = [];
        foreach ($products as $product) {
            if (($product['panel_switch_enabled'] ?? false) === true && is_string($product['name'] ?? null)) {
                $choices[$product['name']] = $this->options;
            }
        }
        return $choices;
    }

    /** Keep an existing product setting when an older staff client omits it. */
    public static function productSetting(array $request): array
    {
        if (!array_key_exists('panel_switch_enabled', $request)) return [];
        if (!is_bool($request['panel_switch_enabled'])) {
            throw new InvalidArgumentException('وضعیت انتخاب سوئیچ باید معتبر باشد.');
        }
        return ['panel_switch_enabled' => $request['panel_switch_enabled']];
    }

    /** Validate the selected switch while accepting orders from older clients. */
    public function choice(array $item, ?array $product = null): string
    {
        if (!array_key_exists('panel_switch', $item)) {
            return '';
        }
        $enabled = $product['panel_switch_enabled'] ?? null;
        $panel = strpos((string) ($item['price_key'] ?? ''), 'panel_') === 0;
        $value = $item['panel_switch'];
        if (!$panel || $enabled === false || !is_string($value) || !in_array($value, $this->options, true)) {
            throw new InvalidArgumentException('سوئیچ ثبت در پنل معتبر نیست.');
        }
        return $value;
    }
}
