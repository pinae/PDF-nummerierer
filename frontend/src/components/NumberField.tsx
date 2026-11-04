import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import { useState } from "react";

export interface NumberFieldProps {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step?: number;
  format?: (value: number) => string;
  onCommit: (value: number) => void;
}

/**
 * Numeric input that applies every valid value immediately but never
 * reformats what is being typed (the formatted value returns on blur).
 */
export function NumberField({
  label,
  value,
  unit,
  min,
  max,
  step = 0.1,
  format = (v) => v.toFixed(1),
  onCommit,
}: NumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <TextField
      label={label}
      type="number"
      size="small"
      value={draft ?? format(value)}
      onChange={(event) => {
        setDraft(event.target.value);
        const parsed = Number.parseFloat(event.target.value);
        if (Number.isFinite(parsed) && parsed >= min && parsed <= max) onCommit(parsed);
      }}
      onBlur={() => setDraft(null)}
      slotProps={{
        input: { endAdornment: <InputAdornment position="end">{unit}</InputAdornment> },
        htmlInput: { min, max, step, inputMode: "decimal" },
      }}
    />
  );
}
