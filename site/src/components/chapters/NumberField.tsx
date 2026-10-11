import { useState } from "react";
import { cx } from "../../lib/cx";

interface NumberFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  disabled?: boolean;
  className?: string;
  onChange: (value: number) => void;
}

// A fill-in blank. The text is kept as typed until blur; every valid keystroke is clamped and reported.
export const NumberField = ({ label, value, min, max, step, suffix, disabled, className, onChange }: NumberFieldProps) => {
  const [text, setText] = useState(String(value));
  const clamp = (parsed: number): number => Math.min(max, Math.max(min, parsed));

  return (
    <label className={cx("relative block has-disabled:opacity-45", className)}>
      <span className="sr-only">{label}</span>
      <input
        className={cx(
          "w-full [appearance:textfield] rounded-t-[3px] border-b-[1.5px] border-ink bg-lift px-2 py-[0.38rem] text-right font-mono text-[0.9rem] transition-colors duration-200 hover:bg-white focus:bg-white focus-visible:outline-offset-1",
          "[&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none",
          suffix && "pr-6"
        )}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={text}
        disabled={disabled}
        onChange={(event) => {
          setText(event.target.value);
          const parsed = Number.parseFloat(event.target.value);
          if (Number.isFinite(parsed)) onChange(clamp(parsed));
        }}
        onBlur={() => {
          const parsed = Number.parseFloat(text);
          setText(String(Number.isFinite(parsed) ? clamp(parsed) : value));
        }}
      />
      {suffix && (
        <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-[55%] font-mono text-[0.82rem]" aria-hidden="true">
          {suffix}
        </span>
      )}
    </label>
  );
};
