import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toTitleCase } from "@/lib/masks";

interface TitleCaseInputProps extends React.ComponentProps<"input"> {
  invalid?: boolean;
  onValueChange?: (v: string) => void;
}

/** Input de texto livre que aplica Title Case (PT-BR) ao perder o foco. */
export const TitleCaseInput = React.forwardRef<HTMLInputElement, TitleCaseInputProps>(
  ({ className, invalid, onBlur, onChange, onValueChange, value, ...rest }, ref) => {
    return (
      <Input
        ref={ref}
        value={value ?? ""}
        aria-invalid={invalid || undefined}
        className={cn(invalid && "border-destructive focus-visible:ring-destructive", className)}
        onChange={(e) => {
          onChange?.(e);
          onValueChange?.(e.target.value);
        }}
        onBlur={(e) => {
          const next = toTitleCase(e.target.value);
          if (next !== e.target.value) {
            const synthetic = { ...e, target: { ...e.target, value: next } } as React.ChangeEvent<HTMLInputElement>;
            onChange?.(synthetic);
            onValueChange?.(next);
          }
          onBlur?.(e);
        }}
        {...rest}
      />
    );
  },
);
TitleCaseInput.displayName = "TitleCaseInput";
