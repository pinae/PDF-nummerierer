import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import { useCallback, useReducer, useState } from "react";
import { Link as RouterLink, useNavigate, useParams } from "react-router";

import { documentFileUrl, startGeneration } from "../api/endpoints";
import { DeleteDocumentButton } from "../components/DeleteDocumentButton";
import { ConfigSection } from "../configs/ConfigSection";
import type { DocumentInfo, Job, PageRole } from "../api/types";
import { startDownload } from "../generation/download";
import { describeError } from "../generation/errors";
import { GenerationDialog, type GenerationState } from "../generation/GenerationDialog";
import { NumbersSection } from "../generation/NumbersSection";
import { runSummary } from "../generation/progress";
import { RunFooter } from "../generation/RunFooter";
import { useLimits } from "../hooks/useLimits";
import { useDocument } from "../hooks/useDocument";
import { useKeepAlive } from "../hooks/useKeepAlive";
import { ptToMm } from "../pdf/coordinates";
import { firstPageOfRole, roleOfPage } from "../pdf/pages";
import { useFonts } from "../placement/fonts";
import { PlacementTools } from "../placement/PlacementTools";
import { RoleSelector } from "../placement/RoleSelector";
import { formatSerial } from "../placement/serial";
import { initialEditorState, placementReducer, ROLES } from "../placement/state";
import { StampOverlay } from "../placement/StampOverlay";
import { ToolsPanel } from "../placement/ToolsPanel";
import { strings } from "../strings";
import { PdfViewer } from "../viewer/PdfViewer";
import type { FinishedRun } from "./DoneScreen";

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
      <Box
        sx={{
          px: { xs: 2, sm: 3 },
          pt: { xs: 1, sm: 2 },
          pb: { xs: 0, sm: 1 },
          display: "flex",
          alignItems: "center",
          gap: 1,
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h5" component="h1" sx={HIDDEN_ON_PHONES}>
            {text.title}
          </Typography>
          {state.status === "ready" && (
            <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
              {state.document.name}
            </Typography>
          )}
        </Box>
        {state.status === "ready" && <DeleteDocumentButton document={state.document} />}
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

const DEFAULT_MAX_COPIES = 9999;
const MAX_START = 999_999_999;

function parseWhole(value: string): number | null {
  return /^\d+$/.test(value.trim()) ? Number(value.trim()) : null;
}

/** The download name the backend uses: "<upload name without extension>-numbered.pdf". */
function downloadName(uploadName: string): string {
  return `${uploadName.replace(/\.[^./]*$/, "")}-numbered.pdf`;
}

function Workspace({ document }: { document: DocumentInfo }) {
  const navigate = useNavigate();
  const limits = useLimits();
  const [page, setPage] = useState(1);
  const [editor, dispatch] = useReducer(placementReducer, document.page_sizes, initialEditorState);
  const [marginMm, setMarginMm] = useState(10);
  const [copiesText, setCopiesText] = useState("1");
  const [startText, setStartText] = useState("1");
  const [padToEven, setPadToEven] = useState(true);
  const [generation, setGeneration] = useState<GenerationState | null>(null);
  const role = roleOfPage(page);
  const placements = editor.config.placements;
  useKeepAlive(document.id);
  const { fonts, loadAll } = useFonts(
    ROLES.map((pageRole) => (placements[pageRole] ?? editor.remembered[pageRole]).font),
  );
  const numberFormat = editor.config.number_format;

  const maxCopies = limits?.max_copies ?? DEFAULT_MAX_COPIES;
  const parsedCopies = parseWhole(copiesText);
  const copiesValid = parsedCopies !== null && parsedCopies >= 1 && parsedCopies <= maxCopies;
  const copies = copiesValid ? parsedCopies : 1;
  const parsedStart = parseWhole(startText);
  const startValid = parsedStart !== null && parsedStart <= MAX_START;
  const start = startValid ? parsedStart : 1;
  const lastNumber = start + copies - 1;
  // The preview shows the widest number of the run, so nothing can overflow later.
  const stampText = formatSerial(numberFormat, lastNumber);
  const sample = strings.generation.sample(formatSerial(numberFormat, start), stampText);
  const summary = runSummary({ copies, pageCount: document.page_count, padToEven });

  async function numberIt() {
    setGeneration({ phase: "starting" });
    try {
      const job = await startGeneration(document.id, {
        copies,
        start,
        pad_to_even: padToEven,
        number_format: numberFormat,
        placements,
      });
      setGeneration({ phase: "running", job });
    } catch (error) {
      setGeneration({ phase: "error", message: describeError(error) });
    }
  }

  const onJob = useCallback((job: Job) => setGeneration({ phase: "running", job }), []);
  const onError = useCallback((message: string) => setGeneration({ phase: "error", message }), []);
  const onDone = useCallback(
    (job: Job) => {
      const downloadUrl = job.download_url ?? `/api/jobs/${job.id}/download/`;
      startDownload(downloadUrl);
      const finished: FinishedRun = {
        documentId: document.id,
        fileName: downloadName(document.name),
        downloadUrl,
        copies: job.copies_total,
        totalPages: job.total_pages,
      };
      navigate("/done", { state: finished });
    },
    [document.id, document.name, navigate],
  );
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
      <ToolsPanel
        title={strings.placement.toolsLabel}
        footer={
          <RunFooter
            copiesText={copiesText}
            copiesValid={copiesValid}
            maxCopies={maxCopies}
            onCopiesChange={setCopiesText}
            summary={summary}
            copies={copies}
            maxPages={limits?.max_output_pages ?? null}
            disabled={!copiesValid || !startValid || generation !== null}
            onNumberIt={numberIt}
          />
        }
      >
        <ConfigSection
          settings={editor.config}
          onApply={(config) => dispatch({ type: "load", config })}
        />
        <Divider sx={{ my: 2 }} />
        <PlacementTools
          role={role}
          placement={placements[role] ?? editor.remembered[role]}
          enabled={placements[role] !== null}
          fonts={fonts}
          pageSize={{ width, height }}
          stampText={stampText}
          marginMm={marginMm}
          onMarginChange={setMarginMm}
          onFontMenuOpen={loadAll}
          dispatch={dispatch}
        />
        <Divider sx={{ my: 2 }} />
        <NumbersSection
          numberFormat={numberFormat}
          onFormatChange={(format) => dispatch({ type: "format", number_format: format })}
          startText={startText}
          startValid={startValid}
          onStartChange={setStartText}
          padToEven={padToEven}
          onPadToEvenChange={setPadToEven}
          sample={sample}
        />
      </ToolsPanel>
      {generation && (
        <GenerationDialog
          state={generation}
          onJob={onJob}
          onError={onError}
          onDone={onDone}
          onClose={() => setGeneration(null)}
        />
      )}
    </Box>
  );
}
