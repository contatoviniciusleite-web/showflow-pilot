import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatCurrencyBRLFromDigits, onlyDigits, parseCurrencyBRL } from "@/lib/masks";

interface CurrencyInputProps
  extends Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> {
  value: number | string | null | undefined;
  onValueChange: (value: number) => void;
  invalid?: boolean;
}

/** Campo monetário em R$ — formata enquanto o usuário digita. */
export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onValueChange, className, invalid, ...rest }, ref) => {
    const initialDigits = React.useMemo(() => {
      if (value == null || value === "") return "";
      const num = typeof value === "number" ? value : Number(value);
      if (isNaN(num) || num === 0) return "";
      return Math.round(num * 100).toString();
    }, []);
    const [digits, setDigits] = React.useState<string>(initialDigits);

    // mantém sincronizado quando o valor externo muda (ex: autocomplete preenche)
    React.useEffect(() => {
      const num = typeof value === "number" ? value : Number(value || 0);
      const expected = !num ? "" : Math.round(num * 100).toString();
      if (expected !== digits) setDigits(expected);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    const display = digits ? formatCurrencyBRLFromDigits(digits) : "";

    return (
      <Input
        ref={ref}
        type="text"
        inputMode="numeric"
        value={display}
        placeholder="R$ 0,00"
        aria-invalid={invalid || undefined}
        className={cn(invalid && "border-destructive focus-visible:ring-destructive", className)}
        onChange={(e) => {
          const d = onlyDigits(e.target.value);
          setDigits(d);
          onValueChange(d ? parseCurrencyBRL(d) : 0);
        }}
        {...rest}
      />
    );
  },
);
CurrencyInput.displayName = "CurrencyInput";
