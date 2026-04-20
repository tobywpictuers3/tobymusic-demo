import * as React from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface NumberStepperProps
  extends Omit<React.ComponentProps<"input">, "type" | "value" | "onChange" | "step"> {
  /** Current numeric value (or string for free-text mode) */
  value: number | string;
  /** Called whenever the value changes. Returns a number (NaN-safe → 0) */
  onValueChange: (value: number) => void;
  /** Increment / decrement step size. Default: 1 */
  step?: number;
  /** Optional minimum (clamps on +/-) */
  min?: number;
  /** Optional maximum (clamps on +/-) */
  max?: number;
  /** Allow negative values via the input even if min isn't set. Default: true */
  allowNegative?: boolean;
  /** Allow decimals. Default: false (integers only) */
  allowDecimals?: boolean;
  /** Wrapper className */
  wrapperClassName?: string;
  /** Optional unit label shown after the value (e.g., "₪", "דק׳") */
  unit?: string;
  /** Size variant: 'sm' | 'md'. Default 'md' */
  sizeVariant?: "sm" | "md";
}

/**
 * Touch-friendly number input with explicit + / − buttons.
 * Works great on mobile (no native spinner reliance) and supports
 * negative values so it can be used for "+ / −" time deltas.
 */
export const NumberStepper = React.forwardRef<HTMLInputElement, NumberStepperProps>(
  (
    {
      value,
      onValueChange,
      step = 1,
      min,
      max,
      allowNegative = true,
      allowDecimals = false,
      wrapperClassName,
      className,
      unit,
      sizeVariant = "md",
      disabled,
      ...rest
    },
    ref
  ) => {
    const parse = React.useCallback(
      (v: string | number): number => {
        if (typeof v === "number") return Number.isFinite(v) ? v : 0;
        if (v === "" || v === "-" || v === "+") return 0;
        const n = allowDecimals ? parseFloat(v) : parseInt(v, 10);
        return Number.isFinite(n) ? n : 0;
      },
      [allowDecimals]
    );

    const clamp = React.useCallback(
      (n: number) => {
        let r = n;
        if (typeof min === "number") r = Math.max(min, r);
        if (typeof max === "number") r = Math.min(max, r);
        if (!allowNegative && typeof min !== "number") r = Math.max(0, r);
        return r;
      },
      [min, max, allowNegative]
    );

    const handleStep = (direction: 1 | -1) => {
      const next = clamp(parse(value) + step * direction);
      onValueChange(next);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      // Allow user to clear or type "-" mid-edit; convert to numeric on blur via parse
      if (raw === "" || raw === "-") {
        onValueChange(0);
        return;
      }
      const n = parse(raw);
      onValueChange(n);
    };

    const btnSize = sizeVariant === "sm" ? "h-9 w-9" : "h-10 w-10";
    const inputSize = sizeVariant === "sm" ? "h-9" : "h-10";

    return (
      <div
        className={cn(
          "flex items-stretch gap-1.5 w-full",
          wrapperClassName
        )}
        dir="ltr"
      >
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => handleStep(-1)}
          disabled={disabled || (typeof min === "number" && parse(value) <= min)}
          aria-label="הפחת"
          className={cn(btnSize, "shrink-0 border-primary/40 text-primary hover:bg-primary/10 active:scale-95 transition")}
        >
          <Minus className="h-4 w-4" />
        </Button>

        <div className="relative flex-1 min-w-0">
          <Input
            ref={ref}
            type="text"
            inputMode={allowDecimals ? "decimal" : "numeric"}
            pattern={allowNegative ? "-?[0-9]*\\.?[0-9]*" : "[0-9]*\\.?[0-9]*"}
            value={value === undefined || value === null ? "" : String(value)}
            onChange={handleChange}
            disabled={disabled}
            className={cn(
              inputSize,
              "text-center font-semibold tabular-nums",
              unit && "pr-8",
              className
            )}
            {...rest}
          />
          {unit && (
            <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-muted-foreground">
              {unit}
            </span>
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => handleStep(1)}
          disabled={disabled || (typeof max === "number" && parse(value) >= max)}
          aria-label="הוסף"
          className={cn(btnSize, "shrink-0 border-primary/40 text-primary hover:bg-primary/10 active:scale-95 transition")}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    );
  }
);
NumberStepper.displayName = "NumberStepper";
