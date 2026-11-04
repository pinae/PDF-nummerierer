import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useEffect, useId, useState, type FormEvent } from "react";

import { ApiError } from "../api/client";
import { listConfigVersions, saveConfig } from "../api/endpoints";
import type { NumberingConfig } from "../api/types";
import type { StampSettings } from "../placement/state";
import { strings } from "../strings";
import { nameKey, sameSettings } from "./compare";
import { useConfigs } from "./useConfigs";

const text = strings.configs;
const MAX_NAME_LENGTH = 80;
const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const settingsOf = (config: NumberingConfig): StampSettings => ({
  number_format: config.number_format,
  placements: config.placements,
});

export interface ConfigSectionProps {
  /** The settings currently shown in the workspace. */
  settings: StampSettings;
  /** Replace the workspace settings with a saved configuration's. */
  onApply: (settings: StampSettings) => void;
}

/** Choose, load (any version) and save the shared, versioned configurations. */
export function ConfigSection({ settings, onApply }: ConfigSectionProps) {
  const { configs, loaded: listLoaded, failed, reload } = useConfigs();
  const [current, setCurrent] = useState<NumberingConfig | null>(null);
  const [baseline, setBaseline] = useState<StampSettings>(settings);
  const [versions, setVersions] = useState<NumberingConfig[]>([]);
  const [pending, setPending] = useState<NumberingConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const configLabel = useId();
  const versionLabel = useId();
  const dirty = !sameSettings(settings, baseline);

  useEffect(() => {
    if (!current) return;
    let active = true;
    listConfigVersions(current.id).then(
      (list) => active && setVersions(list),
      () => undefined,
    );
    return () => {
      active = false;
    };
  }, [current]);

  function apply(config: NumberingConfig) {
    onApply(settingsOf(config));
    setBaseline(settingsOf(config));
    setCurrent(config);
  }

  function request(config: NumberingConfig | undefined) {
    if (!config || config.id === current?.id) return;
    if (dirty) setPending(config);
    else apply(config);
  }

  const latestForCurrent = current
    ? configs.find((config) => nameKey(config.name) === nameKey(current.name))
    : undefined;

  return (
    <Stack spacing={1.5}>
      <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 600 }}>
        {text.title}
      </Typography>
      {failed && <Alert severity="warning">{text.listError}</Alert>}

      <FormControl size="small" fullWidth disabled={!listLoaded || failed}>
        <InputLabel id={configLabel}>{text.saved}</InputLabel>
        <Select
          labelId={configLabel}
          label={text.saved}
          value={latestForCurrent?.id ?? ""}
          renderValue={(id) => configs.find((config) => config.id === id)?.name ?? ""}
          onChange={(event) => request(configs.find((config) => config.id === event.target.value))}
        >
          {configs.length === 0 && (
            <MenuItem value="" disabled>
              {text.choose}
            </MenuItem>
          )}
          {configs.map((config) => (
            <MenuItem key={config.id} value={config.id}>
              <ListItemText primary={config.name} secondary={`Version ${config.version}`} />
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {current && versions.length > 1 && (
        <FormControl size="small" fullWidth>
          <InputLabel id={versionLabel}>{text.version}</InputLabel>
          <Select
            labelId={versionLabel}
            label={text.version}
            value={versions.some((v) => v.id === current.id) ? current.id : ""}
            onChange={(event) => request(versions.find((v) => v.id === event.target.value))}
          >
            {versions.map((version) => (
              <MenuItem key={version.id} value={version.id}>
                {text.versionOption(
                  version.version,
                  dateFormat.format(new Date(version.created_at)),
                )}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
          {current
            ? text.status(current.version, Math.max(versions.length, current.version))
            : text.notSaved}
        </Typography>
        {current && dirty && <Chip size="small" color="warning" label={text.modified} />}
        <Button variant="outlined" size="small" onClick={() => setSaving(true)}>
          {text.save}
        </Button>
      </Box>
      <Typography variant="caption" color="text.secondary">
        {text.shared}
      </Typography>

      {saving && (
        <SaveDialog
          configs={configs}
          initialName={current?.name ?? ""}
          settings={settings}
          onClose={() => setSaving(false)}
          onSaved={(saved, unchanged) => {
            setSaving(false);
            setCurrent(saved);
            setBaseline(settings);
            setMessage(
              unchanged ? text.unchanged(saved.version) : text.saved_(saved.name, saved.version),
            );
            reload();
          }}
        />
      )}

      <Dialog
        open={pending !== null}
        onClose={() => setPending(null)}
        aria-labelledby={`${configLabel}-discard`}
      >
        <DialogTitle id={`${configLabel}-discard`}>{text.discardTitle}</DialogTitle>
        <DialogContent>
          <DialogContentText>{text.discardText}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPending(null)}>{text.keepEditing}</Button>
          <Button
            color="warning"
            onClick={() => {
              if (pending) apply(pending);
              setPending(null);
            }}
          >
            {text.discard}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={message !== null}
        autoHideDuration={6000}
        onClose={() => setMessage(null)}
        message={message}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Stack>
  );
}

interface SaveDialogProps {
  configs: NumberingConfig[];
  initialName: string;
  settings: StampSettings;
  onClose: () => void;
  onSaved: (saved: NumberingConfig, unchanged: boolean) => void;
}

function SaveDialog({ configs, initialName, settings, onClose, onSaved }: SaveDialogProps) {
  const titleId = useId();
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const existing = configs.find((config) => nameKey(config.name) === nameKey(name));
  const valid = name.trim().length > 0 && name.trim().length <= MAX_NAME_LENGTH;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setErrors([]);
    try {
      const saved = await saveConfig({ name, ...settings });
      onSaved(
        saved,
        configs.some((config) => config.id === saved.id),
      );
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fields).length) {
        setErrors(Object.values(error.fields).flat());
      } else {
        setErrors([(error as Error).message]);
      }
      setBusy(false);
    }
  }

  return (
    <Dialog open onClose={onClose} aria-labelledby={titleId} fullWidth maxWidth="xs">
      <form onSubmit={submit}>
        <DialogTitle id={titleId}>{text.saveTitle}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label={text.name}
            value={name}
            onChange={(event) => setName(event.target.value)}
            slotProps={{ htmlInput: { maxLength: MAX_NAME_LENGTH } }}
            helperText={
              name.trim()
                ? existing
                  ? text.nextVersion(existing.name, existing.version + 1)
                  : text.createsNew
                : " "
            }
          />
          {errors.length > 0 && (
            <Alert severity="error" sx={{ mt: 1 }}>
              {errors.map((error) => (
                <div key={error}>{error}</div>
              ))}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>{text.cancel}</Button>
          <Button type="submit" variant="contained" disabled={!valid || busy}>
            {text.save}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
