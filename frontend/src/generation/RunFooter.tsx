import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import { strings } from "../strings";
import type { RunSummary } from "./progress";

const text = strings.generation;
const grouped = new Intl.NumberFormat("en-GB");

export interface RunFooterProps {
  copiesText: string;
  copiesValid: boolean;
  maxCopies: number;
  onCopiesChange: (value: string) => void;
  summary: RunSummary | null;
  copies: number;
  maxPages: number | null;
  disabled: boolean;
  onNumberIt: () => void;
}

/** Always visible: how many copies, what that means, and the primary action. */
export function RunFooter({
  copiesText,
  copiesValid,
  maxCopies,
  onCopiesChange,
  summary,
  copies,
  maxPages,
  disabled,
  onNumberIt,
}: RunFooterProps) {
  const tooMany = summary !== null && maxPages !== null && summary.totalPages > maxPages;
  return (
    <Stack spacing={1}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
        <TextField
          size="small"
          label={text.copies}
          value={copiesText}
          onChange={(event) => onCopiesChange(event.target.value)}
          error={!copiesValid}
          helperText={copiesValid ? undefined : text.copiesRange(maxCopies)}
          slotProps={{ htmlInput: { inputMode: "numeric" } }}
          sx={{ width: 120, flexShrink: 0 }}
        />
        <Button
          variant="contained"
          size="large"
          fullWidth
          disabled={disabled || tooMany}
          onClick={onNumberIt}
        >
          {text.numberIt}
        </Button>
      </Stack>
      {summary && copiesValid && (
        <Typography variant="body2">
          {text.summary(copies, summary.pagesPerCopy, summary.totalPages)}
        </Typography>
      )}
      {summary?.padded && copiesValid && (
        <Typography variant="caption" color="text.secondary">
          {text.paddingNote}
        </Typography>
      )}
      {tooMany && maxPages !== null && (
        <Alert severity="warning">{text.tooManyPages(grouped.format(maxPages))}</Alert>
      )}
    </Stack>
  );
}
