import CloudUploadOutlined from "@mui/icons-material/CloudUploadOutlined";
import LockOutlined from "@mui/icons-material/LockOutlined";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useNavigate } from "react-router";

import { ApiError } from "../api/client";
import { uploadDocument } from "../api/upload";
import { formatBytes, formatDuration } from "../format";
import { useLimits } from "../hooks/useLimits";
import { strings } from "../strings";

const text = strings.upload;

type UploadState =
  | { kind: "idle"; error: string | null }
  | { kind: "uploading"; file: File; progress: number; controller: AbortController };

function isPdf(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function errorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return strings.errors.server;
  switch (error.code) {
    case "not_pdf":
    case "encrypted_pdf":
    case "invalid_pdf":
    case "throttled":
    case "missing_file":
      return text.errors[error.code];
    case "network_error":
      return strings.errors.network;
    default:
      return error.message || strings.errors.server;
  }
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function UploadScreen() {
  const navigate = useNavigate();
  const limits = useLimits();
  const input = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [state, setState] = useState<UploadState>({ kind: "idle", error: null });

  // A PDF dropped next to the drop zone must not make the browser open it.
  useEffect(() => {
    const ignore = (event: Event) => event.preventDefault();
    window.addEventListener("dragover", ignore);
    window.addEventListener("drop", ignore);
    return () => {
      window.removeEventListener("dragover", ignore);
      window.removeEventListener("drop", ignore);
    };
  }, []);

  async function start(files: File[]) {
    if (state.kind === "uploading") return;
    const fail = (error: string) => setState({ kind: "idle", error });
    const [file] = files;
    if (files.length !== 1 || !file) return fail(text.errors.single_file);
    if (!isPdf(file)) return fail(text.errors.not_pdf);
    if (limits && file.size > limits.max_upload_bytes) {
      return fail(
        text.errors.too_large(formatBytes(file.size), formatBytes(limits.max_upload_bytes)),
      );
    }

    const controller = new AbortController();
    setState({ kind: "uploading", file, progress: 0, controller });
    try {
      const document = await uploadDocument(file, {
        signal: controller.signal,
        onProgress: (progress) =>
          setState((current) =>
            current.kind === "uploading" && current.controller === controller
              ? { ...current, progress }
              : current,
          ),
      });
      navigate(`/exams/${encodeURIComponent(document.id)}`);
    } catch (error) {
      setState({ kind: "idle", error: isAbort(error) ? null : errorMessage(error) });
    }
  }

  function onInputChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = ""; // choosing the same file again must trigger a new change event
    if (files.length) void start(files);
  }

  function onDragEnter(event: DragEvent) {
    event.preventDefault();
    dragDepth.current += 1;
    if (Array.from(event.dataTransfer.types).includes("Files")) setDragging(true);
  }

  function onDragLeave(event: DragEvent) {
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    void start(Array.from(event.dataTransfer.files));
  }

  const uploading = state.kind === "uploading" ? state : null;
  const error = state.kind === "idle" ? state.error : null;

  return (
    <Container maxWidth="md" sx={{ py: { xs: 3, sm: 6 } }}>
      <Typography variant="h4" component="h1" gutterBottom>
        {text.title}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        {strings.tagline}
      </Typography>

      <Paper
        role="region"
        aria-label={text.dropzoneLabel}
        variant="outlined"
        onDragEnter={onDragEnter}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        sx={{
          borderWidth: 2,
          borderStyle: "dashed",
          borderColor: dragging ? "primary.main" : "divider",
          bgcolor: dragging ? "action.hover" : "background.paper",
          borderRadius: 3,
          minHeight: { xs: 220, sm: 280 },
          px: 3,
          py: 4,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          transition: "border-color 120ms, background-color 120ms",
        }}
      >
        {uploading ? (
          <Stack spacing={2} sx={{ width: "100%", maxWidth: 420 }}>
            <Typography sx={{ overflowWrap: "anywhere" }}>
              {text.uploading(uploading.file.name)}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={Math.round(uploading.progress * 100)}
              aria-label={text.progressLabel}
            />
            <Typography variant="body2" color="text.secondary">
              {Math.round(uploading.progress * 100)} %
            </Typography>
            <Box>
              <Button onClick={() => uploading.controller.abort()}>{text.cancel}</Button>
            </Box>
          </Stack>
        ) : (
          <Stack spacing={1.5} sx={{ alignItems: "center" }}>
            <CloudUploadOutlined sx={{ fontSize: 56, color: "primary.main" }} aria-hidden />
            {dragging ? (
              <Typography variant="h6">{text.dropNow}</Typography>
            ) : (
              <Box sx={{ "@media (pointer: coarse)": { display: "none" } }}>
                <Typography variant="h6">{text.dropHint}</Typography>
                <Typography color="text.secondary">{text.or}</Typography>
              </Box>
            )}
            <Button variant="contained" size="large" onClick={() => input.current?.click()}>
              {text.choose}
            </Button>
            {limits && (
              <Typography variant="body2" color="text.secondary">
                {text.limit(formatBytes(limits.max_upload_bytes))}
              </Typography>
            )}
          </Stack>
        )}
        <input
          ref={input}
          type="file"
          accept="application/pdf,.pdf"
          aria-label={text.inputLabel}
          hidden
          onChange={onInputChange}
        />
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      <Stack direction="row" spacing={1.5} sx={{ mt: 3, alignItems: "flex-start" }}>
        <LockOutlined color="action" aria-hidden sx={{ mt: 0.25 }} />
        <Typography variant="body2" color="text.secondary">
          {text.privacy} {text.deletion(limits ? formatDuration(limits.retention_seconds) : null)}
        </Typography>
      </Stack>

      <Typography variant="h6" component="h2" sx={{ mt: 4, mb: 1 }}>
        {text.stepsLabel}
      </Typography>
      <Box component="ol" aria-label={text.stepsLabel} sx={{ pl: 3, m: 0 }}>
        {text.steps.map((step) => (
          <Typography component="li" key={step} sx={{ mb: 0.5 }}>
            {step}
          </Typography>
        ))}
      </Box>
    </Container>
  );
}
