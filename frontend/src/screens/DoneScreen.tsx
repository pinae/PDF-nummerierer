import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";
import { Link as RouterLink, useLocation } from "react-router";

import { ApiError } from "../api/client";
import { deleteDocument, getDocument } from "../api/endpoints";
import { startDownload } from "../generation/download";
import { sleep, timing } from "../generation/timing";
import { strings } from "../strings";

const text = strings.done;

/** What the workspace hands over when the download starts (kept in history state). */
export interface FinishedRun {
  documentId: string;
  fileName: string;
  downloadUrl: string;
  copies: number;
  totalPages: number;
}

const isGone = (error: unknown) => error instanceof ApiError && error.status === 404;

export function DoneScreen() {
  const run = useLocation().state as FinishedRun | null;
  if (!run?.documentId) {
    return (
      <Container maxWidth="sm" sx={{ py: { xs: 3, sm: 6 } }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {text.title}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {text.nothing}
        </Typography>
        <Button component={RouterLink} to="/" variant="contained">
          {text.start}
        </Button>
      </Container>
    );
  }
  return <Finished run={run} />;
}

function Finished({ run }: { run: FinishedRun }) {
  const [deleted, setDeleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The server deletes the exam once the download is complete; watch for that.
  useEffect(() => {
    if (deleted) return;
    let cancelled = false;
    (async () => {
      while (!cancelled) {
        try {
          await getDocument(run.documentId);
        } catch (caught) {
          if (cancelled) return;
          if (isGone(caught)) return setDeleted(true);
        }
        await sleep(timing.documentPollMs);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [deleted, run.documentId]);

  async function deleteNow() {
    setError(null);
    try {
      await deleteDocument(run.documentId);
      setDeleted(true);
    } catch (caught) {
      if (isGone(caught)) setDeleted(true);
      else setError((caught as Error).message);
    }
  }

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 3, sm: 6 } }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 2 }}>
        <CheckCircleOutlined color="success" sx={{ fontSize: 40 }} aria-hidden />
        <Typography variant="h4" component="h1">
          {text.title}
        </Typography>
      </Stack>
      <Typography gutterBottom>{text.started(run.fileName)}</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {text.summary(run.copies, run.totalPages)}
      </Typography>

      {deleted ? (
        <Alert severity="success" sx={{ mb: 3 }}>
          {text.deleted}
        </Alert>
      ) : (
        <Stack spacing={2} sx={{ mb: 3 }}>
          <Typography variant="body2">{text.waiting}</Typography>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
            <Button variant="outlined" onClick={() => startDownload(run.downloadUrl)}>
              {text.downloadAgain}
            </Button>
            <Button variant="outlined" color="warning" onClick={deleteNow}>
              {text.deleteNow}
            </Button>
          </Stack>
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      )}

      <Button component={RouterLink} to="/" variant="contained">
        {text.another}
      </Button>
    </Container>
  );
}
