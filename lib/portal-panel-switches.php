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
                $models = $this->models($product);
                if ($models) $choices[$product['name']] = $models;
            }
        }
        return $choices;
    }

    /** Keep an existing product setting when an older staff client omits it. */
    public function productSetting(array $request): array
    {
        if (array_key_exists('panel_switch_models', $request)) {
            $models = $request['panel_switch_models'];
            if (!is_array($models) || array_values($models) !== $models
                || array_filter($models, fn ($model): bool => !is_string($model) || !in_array($model, $this->options, true))) {
                throw new InvalidArgumentException('مدل سوئیچ معتبر نیست.');
            }
            $selected = array_values(array_intersect($this->options, $models));
            return ['panel_switch_enabled' => (bool) $selected, 'panel_switch_models' => $selected];
        }
        if (!array_key_exists('panel_switch_enabled', $request)) return [];
        if (!is_bool($request['panel_switch_enabled'])) {
            throw new InvalidArgumentException('وضعیت انتخاب سوئیچ باید معتبر باشد.');
        }
        return ['panel_switch_enabled' => $request['panel_switch_enabled'], 'panel_switch_models' => $request['panel_switch_enabled'] ? $this->options : []];
    }

    /** Preserve enabled products configured before individual model selection. */
    private function models(array $product): array
    {
        $models = $product['panel_switch_models'] ?? $this->options;
        return is_array($models) ? array_values(array_filter($this->options, static fn (string $option): bool => in_array($option, $models, true))) : [];
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
        if (!$panel || $enabled === false || !is_string($value) || !in_array($value, $this->models($product ?? []), true)) {
            throw new InvalidArgumentException('سوئیچ ثبت در پنل معتبر نیست.');
        }
        return $value;
    }
}
