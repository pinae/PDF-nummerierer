import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";
import { useEffect, useId } from "react";

import { getJob } from "../api/endpoints";
import type { Job } from "../api/types";
import { strings } from "../strings";
import { describeError } from "./errors";
import { progressOf } from "./progress";
import { sleep, timing } from "./timing";

const text = strings.generation;

export type GenerationState =
  { phase: "starting" } | { phase: "running"; job: Job } | { phase: "error"; message: string };

export interface GenerationDialogProps {
  state: GenerationState;
  onJob: (job: Job) => void;
  onError: (message: string) => void;
  onDone: (job: Job) => void;
  onClose: () => void;
}

/** Determinate, staged progress while the server generates the copies. */
export function GenerationDialog({
  state,
  onJob,
  onError,
  onDone,
  onClose,
}: GenerationDialogProps) {
  const titleId = useId();
  const jobId = state.phase === "running" ? state.job.id : null;

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    (async () => {
      try {
        while (!cancelled) {
          await sleep(timing.jobPollMs);
          if (cancelled) return;
          const job = await getJob(jobId);
          if (cancelled) return;
          if (job.status === "done") return onDone(job);
          if (job.status === "failed") return onError(job.error?.message ?? text.failed);
          onJob(job);
        }
      } catch (error) {
        if (!cancelled) onError(describeError(error));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId, onDone, onError, onJob]);

  const progress =
    state.phase === "running" ? progressOf(state.job) : { label: text.stages.waiting, percent: 0 };

  return (
    <Dialog open aria-labelledby={titleId} fullWidth maxWidth="xs">
      <DialogTitle id={titleId}>{text.progressTitle}</DialogTitle>
      <DialogContent>
        {state.phase === "error" ? (
          <Alert severity="error">
            <AlertTitle>{text.failed}</AlertTitle>
            <Typography variant="body2">{state.message}</Typography>
          </Alert>
        ) : (
          <>
            <Typography sx={{ mb: 1.5 }}>{progress.label}</Typography>
            <LinearProgress
              variant="determinate"
              value={progress.percent}
              aria-label={text.progressLabel}
            />
          </>
        )}
      </DialogContent>
      {state.phase === "error" && (
        <DialogActions>
          <Button onClick={onClose}>{text.close}</Button>
        </DialogActions>
      )}
    </Dialog>
  );
}
