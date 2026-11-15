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

    /** Validate the selected switch while accepting orders from older clients. */
    public function choice(array $item): string
    {
        if (!array_key_exists('panel_switch', $item)) {
            return '';
        }
        $value = $item['panel_switch'];
        if (strpos((string) ($item['price_key'] ?? ''), 'panel_') !== 0 ||
            !is_string($value) || !in_array($value, $this->options, true)) {
            throw new InvalidArgumentException('سوئیچ ثبت در پنل معتبر نیست.');
        }
        return $value;
    }
}
