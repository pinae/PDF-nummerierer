import DeleteOutlineOutlined from "@mui/icons-material/DeleteOutlineOutlined";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import { useId, useState } from "react";
import { useNavigate } from "react-router";

import { ApiError } from "../api/client";
import { deleteDocument } from "../api/endpoints";
import type { DocumentInfo } from "../api/types";
import { strings } from "../strings";

const text = strings.workspace;

/** Delete the uploaded PDF right away and start over on the upload page. */
export function DeleteDocumentButton({ document }: { document: DocumentInfo }) {
  const navigate = useNavigate();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await deleteDocument(document.id);
    } catch (caught) {
      if (!(caught instanceof ApiError && caught.status === 404)) {
        setError((caught as Error).message);
        setBusy(false);
        return;
      }
    }
    // Replace: "back" must not lead to the deleted exam.
    navigate("/", { replace: true });
  }

  return (
    <>
      <Button
        size="small"
        color="inherit"
        startIcon={<DeleteOutlineOutlined />}
        onClick={() => setOpen(true)}
        sx={{ flexShrink: 0 }}
      >
        {text.deletePdf}
      </Button>
      <Dialog open={open} onClose={() => !busy && setOpen(false)} aria-labelledby={titleId}>
        <DialogTitle id={titleId}>{text.deleteTitle}</DialogTitle>
        <DialogContent>
          <DialogContentText>{text.deleteText(document.name)}</DialogContentText>
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={busy}>
            {text.cancel}
          </Button>
          <Button color="error" variant="contained" onClick={confirm} disabled={busy}>
            {text.deleteConfirm}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
