import FitScreen from "@mui/icons-material/FitScreen";
import NavigateBefore from "@mui/icons-material/NavigateBefore";
import NavigateNext from "@mui/icons-material/NavigateNext";
import WidthFull from "@mui/icons-material/WidthFull";
import ZoomIn from "@mui/icons-material/ZoomIn";
import ZoomOut from "@mui/icons-material/ZoomOut";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { useState, type KeyboardEvent, type ReactNode } from "react";
import { Document, Page, pdfjs } from "react-pdf";

import type { PageRole } from "../api/types";
import { useElementSize } from "../hooks/useElementSize";
import type { Size } from "../pdf/coordinates";
import { firstPageOfRole } from "../pdf/pages";
import { strings } from "../strings";
import { formatZoom, resolveScale, VIEWPORT_PADDING, zoomIn, zoomOut, type Zoom } from "./zoom";

// Must be set in the module that renders react-pdf components (see react-pdf docs).
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

/** pdf.js resources copied into the build by vite.config.ts; module-level so they never change. */
const PDF_OPTIONS = {
  cMapUrl: "/pdfjs/cmaps/",
  standardFontDataUrl: "/pdfjs/standard_fonts/",
  wasmUrl: "/pdfjs/wasm/",
  iccUrl: "/pdfjs/iccs/",
};

const text = strings.viewer;

/** Hidden on screen, still read by screen readers. */
const VISUALLY_HIDDEN = {
  position: "absolute",
  width: 1,
  height: 1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
} as const;

export interface OverlayInfo {
  pageNumber: number;
  /** Displayed page size in PDF points. */
  pageSize: Size;
  /** CSS pixels per PDF point. */
  scale: number;
}

export interface PdfViewerProps {
  fileUrl: string;
  /** [width, height] in points per page, as displayed (from the backend). */
  pageSizes: [number, number][];
  page: number;
  onPageChange: (page: number) => void;
  /** Rendered on top of the page, exactly covering it. */
  renderOverlay?: (info: OverlayInfo) => ReactNode;
  /** Show the First/Odd/Even/Last jump buttons (the workspace has its own role selector). */
  showJumps?: boolean;
}

const JUMPS: { key: "first" | PageRole | "last"; role?: PageRole }[] = [
  { key: "first", role: "first" },
  { key: "odd", role: "odd" },
  { key: "even", role: "even" },
  { key: "last" },
];

export function PdfViewer({
  fileUrl,
  pageSizes,
  page,
  onPageChange,
  renderOverlay,
  showJumps = true,
}: PdfViewerProps) {
  const [zoom, setZoom] = useState<Zoom>({ kind: "fit-page" });
  const [viewportRef, viewport] = useElementSize<HTMLDivElement>();
  const pageCount = pageSizes.length;
  const current = Math.min(Math.max(page, 1), Math.max(pageCount, 1));
  const [width, height] = pageSizes[current - 1] ?? [595.28, 841.89];
  const pageSize = { width, height };
  const scale = resolveScale(zoom, pageSize, viewport);
  const go = (target: number) => onPageChange(Math.min(Math.max(target, 1), pageCount));

  function onKeyDown(event: KeyboardEvent) {
    const targets: Record<string, number> = {
      PageDown: current + 1,
      PageUp: current - 1,
      Home: 1,
      End: pageCount,
    };
    const target = targets[event.key];
    if (target === undefined) return;
    event.preventDefault();
    go(target);
  }

  const fitValue = zoom.kind === "factor" ? null : zoom.kind;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <Box
        role="toolbar"
        aria-label={text.toolbarLabel}
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 1,
          px: { xs: 1, sm: 2 },
          py: 1,
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <IconButton
            aria-label={text.previous}
            disabled={current <= 1}
            onClick={() => go(current - 1)}
          >
            <NavigateBefore />
          </IconButton>
          <Typography
            role="status"
            sx={{ minWidth: { xs: "3.5em", sm: "8.5em" }, textAlign: "center" }}
          >
            <Box
              component="span"
              sx={(theme) => ({ [theme.breakpoints.down("sm")]: VISUALLY_HIDDEN })}
            >
              {text.pageOf(current, pageCount)}
            </Box>
            <Box
              component="span"
              aria-hidden
              sx={(theme) => ({
                display: "none",
                [theme.breakpoints.down("sm")]: { display: "inline" },
              })}
            >
              {current} / {pageCount}
            </Box>
          </Typography>
          <IconButton
            aria-label={text.next}
            disabled={current >= pageCount}
            onClick={() => go(current + 1)}
          >
            <NavigateNext />
          </IconButton>
        </Box>

        {showJumps && (
          <ButtonGroup size="small" variant="outlined">
            {JUMPS.map(({ key, role }) => {
              const target = role ? firstPageOfRole(role, pageCount) : pageCount;
              return (
                <Button
                  key={key}
                  aria-label={text.jump[key]}
                  disabled={target === null}
                  onClick={() => target !== null && go(target)}
                >
                  {text.jumpText[key]}
                </Button>
              );
            })}
          </ButtonGroup>
        )}

        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, ml: { md: "auto" } }}>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={fitValue}
            onChange={(_, value: "fit-page" | "fit-width" | null) =>
              value && setZoom({ kind: value })
            }
          >
            <ToggleButton value="fit-page" aria-label={text.fitPage}>
              <FitScreen fontSize="small" />
            </ToggleButton>
            <ToggleButton value="fit-width" aria-label={text.fitWidth}>
              <WidthFull fontSize="small" />
            </ToggleButton>
          </ToggleButtonGroup>
          <IconButton aria-label={text.zoomOut} onClick={() => setZoom(zoomOut(scale))}>
            <ZoomOut />
          </IconButton>
          <Typography aria-live="polite" sx={{ minWidth: "3.5em", textAlign: "center" }}>
            {formatZoom(scale)}
          </Typography>
          <IconButton aria-label={text.zoomIn} onClick={() => setZoom(zoomIn(scale))}>
            <ZoomIn />
          </IconButton>
        </Box>
      </Box>

      <Box
        ref={viewportRef}
        role="region"
        aria-label={text.previewLabel}
        tabIndex={0}
        onKeyDown={onKeyDown}
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          bgcolor: "action.hover",
          "&:focus-visible": { outline: 2, outlineColor: "primary.main", outlineOffset: -2 },
        }}
      >
        <Box
          sx={{
            p: `${VIEWPORT_PADDING}px`,
            minWidth: "fit-content",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <Document
            file={fileUrl}
            options={PDF_OPTIONS}
            loading={<CircularProgress aria-label={text.loading} />}
            error={<Alert severity="error">{text.loadError}</Alert>}
          >
            <Box
              sx={{
                position: "relative",
                width: width * scale,
                height: height * scale,
                bgcolor: "#fff",
                boxShadow: 3,
              }}
            >
              <Page
                pageNumber={current}
                width={width * scale}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                loading={null}
              />
              {renderOverlay && (
                <Box sx={{ position: "absolute", inset: 0 }}>
                  {renderOverlay({ pageNumber: current, pageSize, scale })}
                </Box>
              )}
            </Box>
          </Document>
        </Box>
      </Box>
    </Box>
  );
}
