import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import { useCallback, useReducer, useState } from "react";
import { Link as RouterLink, useParams } from "react-router";

import { documentFileUrl } from "../api/endpoints";
import type { DocumentInfo, PageRole } from "../api/types";
import { useDocument } from "../hooks/useDocument";
import { ptToMm } from "../pdf/coordinates";
import { firstPageOfRole, roleOfPage } from "../pdf/pages";
import { useFonts } from "../placement/fonts";
import { PlacementTools } from "../placement/PlacementTools";
import { RoleSelector } from "../placement/RoleSelector";
import { formatSerial } from "../placement/serial";
import { initialEditorState, placementReducer, PREVIEW_NUMBER } from "../placement/state";
import { StampOverlay } from "../placement/StampOverlay";
import { ToolsPanel } from "../placement/ToolsPanel";
import { strings } from "../strings";
import { PdfViewer } from "../viewer/PdfViewer";

const text = strings.workspace;

/** On phones the title is only announced, to leave the screen to the page. */
const HIDDEN_ON_PHONES = {
  "@media (max-width: 599.95px)": {
    position: "absolute",
    width: 1,
    height: 1,
    overflow: "hidden",
    clip: "rect(0 0 0 0)",
    whiteSpace: "nowrap",
  },
} as const;

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
      <Box sx={{ px: { xs: 2, sm: 3 }, pt: 2, pb: 1, ...HIDDEN_ON_PHONES }}>
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
  const [editor, dispatch] = useReducer(placementReducer, document.page_sizes, initialEditorState);
  const [marginMm, setMarginMm] = useState(10);
  const { fonts } = useFonts();
  const role = roleOfPage(page);
  const placements = editor.config.placements;
  const stampText = formatSerial(editor.config.number_format, PREVIEW_NUMBER);
  const [width, height] = document.page_sizes[page - 1] ?? [595.28, 841.89];

  const selectRole = (target: PageRole) => {
    const first = firstPageOfRole(target, document.page_count);
    if (first !== null) setPage(first);
  };
  const moveOnPage = useCallback(
    (pageNumber: number, point: { x: number; y: number }) =>
      dispatch({ type: "move", role: roleOfPage(pageNumber), ...point }),
    [],
  );

  return (
    <Box
      sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: { xs: "column", md: "row" } }}
    >
      <Box sx={{ flex: 1, minHeight: 0, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <RoleSelector
          active={role}
          pageCount={document.page_count}
          placements={placements}
          onSelect={selectRole}
        />
        <PdfViewer
          fileUrl={documentFileUrl(document.id)}
          pageSizes={document.page_sizes}
          page={page}
          onPageChange={setPage}
          showJumps={false}
          renderOverlay={(info) => {
            const pageRole = roleOfPage(info.pageNumber);
            const placement = placements[pageRole] ?? editor.remembered[pageRole];
            return (
              <StampOverlay
                info={info}
                placement={placement}
                visible={placements[pageRole] !== null}
                text={stampText}
                label={strings.placement.markerLabel(
                  strings.placement.where[pageRole],
                  ptToMm(placement.x).toFixed(1),
                  ptToMm(placement.y).toFixed(1),
                )}
                onMove={(point) => moveOnPage(info.pageNumber, point)}
              />
            );
          }}
        />
      </Box>
      <ToolsPanel title={strings.placement.toolsLabel}>
        <PlacementTools
          role={role}
          placement={placements[role] ?? editor.remembered[role]}
          enabled={placements[role] !== null}
          fonts={fonts}
          pageSize={{ width, height }}
          stampText={stampText}
          marginMm={marginMm}
          onMarginChange={setMarginMm}
          dispatch={dispatch}
        />
      </ToolsPanel>
    </Box>
  );
}
