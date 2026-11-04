import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import type { NumberFormat } from "../api/types";
import { strings } from "../strings";

const text = strings.generation;
const MAX_AFFIX = 40;
const DIGITS = Array.from({ length: 12 }, (_, index) => index + 1);

export interface NumbersSectionProps {
  numberFormat: NumberFormat;
  onFormatChange: (format: NumberFormat) => void;
  startText: string;
  startValid: boolean;
  onStartChange: (value: string) => void;
  padToEven: boolean;
  onPadToEvenChange: (value: boolean) => void;
  sample: string;
}

/** How the numbers look and where they start; part of the run, not the placement. */
export function NumbersSection({
  numberFormat,
  onFormatChange,
  startText,
  startValid,
  onStartChange,
  padToEven,
  onPadToEvenChange,
  sample,
}: NumbersSectionProps) {
  return (
    <Stack spacing={1.5}>
      <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 600 }}>
        {text.numbersTitle}
      </Typography>
      <Stack direction="row" spacing={1}>
        <TextField
          size="small"
          label={text.prefix}
          value={numberFormat.prefix}
          onChange={(event) => onFormatChange({ ...numberFormat, prefix: event.target.value })}
          slotProps={{ htmlInput: { maxLength: MAX_AFFIX } }}
        />
        <TextField
          select
          size="small"
          label={text.digits}
          value={numberFormat.digits}
          onChange={(event) =>
            onFormatChange({ ...numberFormat, digits: Number(event.target.value) })
          }
          sx={{ minWidth: 88 }}
        >
          {DIGITS.map((digits) => (
            <MenuItem key={digits} value={digits}>
              {digits}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          label={text.suffix}
          value={numberFormat.suffix}
          onChange={(event) => onFormatChange({ ...numberFormat, suffix: event.target.value })}
          slotProps={{ htmlInput: { maxLength: MAX_AFFIX } }}
        />
      </Stack>
      <TextField
        size="small"
        label={text.start}
        value={startText}
        onChange={(event) => onStartChange(event.target.value)}
        error={!startValid}
        helperText={startValid ? " " : text.startRange}
        slotProps={{ htmlInput: { inputMode: "numeric" } }}
        sx={{ maxWidth: 180 }}
      />
      <Typography variant="body2" sx={{ fontFamily: "monospace", overflowWrap: "anywhere" }}>
        {sample}
      </Typography>
      <FormControlLabel
        control={
          <Switch
            checked={padToEven}
            onChange={(event) => onPadToEvenChange(event.target.checked)}
            slotProps={{ input: { role: "switch" } }}
          />
        }
        label={text.duplex}
      />
      <Typography variant="caption" color="text.secondary" sx={{ mt: -1 }}>
        {text.duplexHint}
      </Typography>
    </Stack>
  );
}
