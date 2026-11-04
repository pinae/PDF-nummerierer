import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { Link as RouterLink, useParams } from "react-router";

import { documentFileUrl } from "../api/endpoints";
import type { DocumentInfo } from "../api/types";
import { useDocument } from "../hooks/useDocument";
import { strings } from "../strings";
import { PdfViewer } from "../viewer/PdfViewer";

const text = strings.workspace;

export function WorkspaceScreen() {
  const { documentId = "" } = useParams();
  return <WorkspaceLoader key={documentId} documentId={documentId} />;
}

function WorkspaceLoader({ documentId }: { documentId: string }) {
  const state = useDocument(documentId);

  if (state.status === "missing") {
    return (
      <Container maxWidth="sm" sx={{ py: { xs: 3, sm: 6 } }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {text.missingTitle}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {text.missingText}
        </Typography>
        <Button component={RouterLink} to="/" variant="contained">
          {text.uploadAgain}
        </Button>
      </Container>
    );
  }

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <Box sx={{ px: { xs: 2, sm: 3 }, pt: 2, pb: 1 }}>
        <Typography variant="h5" component="h1">
          {text.title}
        </Typography>
        {state.status === "ready" && (
          <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
            {state.document.name}
          </Typography>
        )}
      </Box>
      {state.status === "loading" && (
        <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
          <CircularProgress aria-label={text.loading} />
        </Box>
      )}
      {state.status === "error" && (
        <Box sx={{ px: { xs: 2, sm: 3 } }}>
          <Alert severity="error">{state.message}</Alert>
        </Box>
      )}
      {state.status === "ready" && <Workspace document={state.document} />}
    </Box>
  );
}

function Workspace({ document }: { document: DocumentInfo }) {
  const [page, setPage] = useState(1);
  return (
    <PdfViewer
      fileUrl={documentFileUrl(document.id)}
      pageSizes={document.page_sizes}
      page={page}
      onPageChange={setPage}
    />
  );
}
