// Base UI wrappers, styled in App.css
import { useEffect, useState, type ReactNode } from "react";
import { Autocomplete } from "@base-ui/react/autocomplete";
import { Field } from "@base-ui/react/field";
import { Select } from "@base-ui/react/select";
import { Slider } from "@base-ui/react/slider";
import { normalizeHex } from "../data/themes";

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <Field.Root className={`field ${className ?? ""}`}>
      <Field.Label className="field-label">{label}</Field.Label>
      <Field.Control className="input" value={value} placeholder={placeholder} onChange={(e) => onChange(e.currentTarget.value)} />
    </Field.Root>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  onChange,
  items,
  className,
}: {
  label?: string;
  value: T;
  onChange: (v: T) => void;
  items: Array<{ value: T; label: string }>;
  className?: string;
}) {
  return (
    <div className={`field ${className ?? ""}`}>
      <Select.Root items={items} value={value} onValueChange={(v) => v != null && onChange(v as T)}>
        {label && <Select.Label className="field-label">{label}</Select.Label>}
        <Select.Trigger className="input select-trigger" aria-label={label ? undefined : "Choose"}>
          <Select.Value />
          <Select.Icon className="select-icon">
            <ChevronIcon />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner className="positioner" sideOffset={4} alignItemWithTrigger={false}>
            <Select.Popup className="popup list-popup">
              <Select.List>
                {items.map((i) => (
                  <Select.Item key={i.value} value={i.value} className="list-item">
                    <Select.ItemText>{i.label}</Select.ItemText>
                    <Select.ItemIndicator className="list-check">
                      <CheckIcon />
                    </Select.ItemIndicator>
                  </Select.Item>
                ))}
              </Select.List>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}

/** Free-text input with suggestions; any value is allowed. */
export function SuggestInput<Item>({
  value,
  onChange,
  items,
  itemToString,
  renderItem,
  filter,
  placeholder,
  ariaLabel,
  className,
  onBlur,
  adornment,
}: {
  value: string;
  onChange: (v: string) => void;
  items: Item[];
  itemToString: (item: Item) => string;
  renderItem?: (item: Item) => ReactNode;
  filter?: (item: Item, query: string) => boolean;
  placeholder?: string;
  ariaLabel: string;
  className?: string;
  onBlur?: () => void;
  adornment?: ReactNode;
}) {
  return (
    <Autocomplete.Root
      items={items}
      value={value}
      onValueChange={(v) => onChange(v)}
      itemToStringValue={itemToString}
      filter={filter ? (item: Item, q: string) => filter(item, q) : undefined}
      openOnInputClick
      autoHighlight
      limit={40}
    >
      <div className={`input suggest ${className ?? ""}`}>
        {adornment}
        <Autocomplete.Input className="suggest-input" placeholder={placeholder} aria-label={ariaLabel} onBlur={onBlur} />
      </div>
      <Autocomplete.Portal>
        <Autocomplete.Positioner className="positioner" sideOffset={4}>
          <Autocomplete.Popup className="popup list-popup">
            <Autocomplete.Empty className="list-empty">No match: keeps what you typed</Autocomplete.Empty>
            <Autocomplete.List>
              {(item: Item) => (
                <Autocomplete.Item key={itemToString(item)} value={item} className="list-item">
                  {renderItem ? renderItem(item) : itemToString(item)}
                </Autocomplete.Item>
              )}
            </Autocomplete.List>
          </Autocomplete.Popup>
        </Autocomplete.Positioner>
      </Autocomplete.Portal>
    </Autocomplete.Root>
  );
}

export function RangeField({
  label,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
}) {
  return (
    <Slider.Root className="range" value={value} min={min} max={max} step={step} onValueChange={(v) => onChange(v as number)}>
      <div className="range-head">
        <Slider.Label className="field-label">{label}</Slider.Label>
        <Slider.Value className="range-value" />
      </div>
      <Slider.Control className="range-control">
        <Slider.Track className="range-track">
          <Slider.Indicator className="range-indicator" />
          <Slider.Thumb className="range-thumb" aria-label={label} />
        </Slider.Track>
      </Slider.Control>
    </Slider.Root>
  );
}

/** Colour swatch (opens the browser's picker) plus a hex box */
export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (hex: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = (text: string) => {
    const hex = normalizeHex(text);
    if (hex) onChange(hex);
    else setDraft(value);
  };

  return (
    <div className="color-field">
      <label className="color-swatch" style={{ background: value }}>
        <input type="color" value={value} aria-label={`${label} colour`} onChange={(e) => onChange(e.currentTarget.value)} />
      </label>
      <span className="color-label">{label}</span>
      <input
        className="input color-hex"
        value={draft}
        spellCheck={false}
        aria-label={`${label} hex code`}
        onChange={(e) => {
          const text = e.currentTarget.value;
          setDraft(text);
          const hex = normalizeHex(text);
          if (hex && text.replace("#", "").length === 6) onChange(hex);
        }}
        onBlur={(e) => commit(e.currentTarget.value)}
        onKeyDown={(e) => e.key === "Enter" && commit(e.currentTarget.value)}
      />
    </div>
  );
}

/**
 * Button label that cross-fades between states. Every label sits in the same grid cell,
 * so the button is always as wide as the longest one and never jumps.
 */
export function SwapLabel<K extends string>({ state, labels }: { state: K; labels: Record<K, ReactNode> }) {
  return (
    <span className="swap">
      {(Object.keys(labels) as K[]).map((k) => (
        <span key={k} className="swap-item" data-active={k === state || undefined} aria-hidden={k !== state || undefined}>
          {labels[k]}
        </span>
      ))}
    </span>
  );
}

export const Spinner = () => <span className="spinner" aria-hidden="true" />;

// Icons are SVG rather than text glyphs (✓, ⋯) so they never pull in a font file
export function CheckIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden="true">
      <path d="M2.5 6.5l2.5 2.5 4.5-5.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MoreIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="3.5" cy="8" r="1.25" fill="currentColor" />
      <circle cx="8" cy="8" r="1.25" fill="currentColor" />
      <circle cx="12.5" cy="8" r="1.25" fill="currentColor" />
    </svg>
  );
}

export function ChevronIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
