import { CATEGORY_COLORS } from "../lib/colors.ts";

interface Props {
  value: string;
  onChange: (color: string) => void;
  /** Accessible label for the group of swatches. */
  label?: string;
}

/**
 * A row of preset color swatches behaving as a single-choice radio group.
 * Keeps color selection simple, accessible and consistent across browsers
 * (no native `<input type="color">` whose default black looks broken).
 */
export function ColorSwatchPicker({ value, onChange, label = "Couleur" }: Props) {
  return (
    <div className="swatches" role="radiogroup" aria-label={label}>
      {CATEGORY_COLORS.map((color) => {
        const selected = color.toLowerCase() === value.toLowerCase();
        return (
          <button
            key={color}
            type="button"
            className={`swatch ${selected ? "swatch--selected" : ""}`}
            style={{ background: color }}
            onClick={() => onChange(color)}
            role="radio"
            aria-checked={selected}
            aria-label={color}
            title={color}
          />
        );
      })}
    </div>
  );
}
