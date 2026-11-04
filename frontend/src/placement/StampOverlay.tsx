import { alpha, useTheme } from "@mui/material/styles";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import type { Placement } from "../api/types";
import { toPixels, toPoints, type Point, type Size } from "../pdf/coordinates";
import type { OverlayInfo } from "../viewer/PdfViewer";
import { fontFamily } from "./fonts";
import { measureText } from "./measure";

export interface StampOverlayProps {
  info: OverlayInfo;
  /** Style and position of this page type (the remembered one if switched off). */
  placement: Placement;
  /** Whether this page type gets a number. */
  visible: boolean;
  text: string;
  label: string;
  /** Move the number (drag, keys); the point is the baseline start in PDF points. */
  onMove: (point: Point) => void;
}

const PAD_PX = 4;

function clampToPage(point: Point, page: Size): Point {
  return {
    x: Math.min(Math.max(point.x, 0), page.width),
    y: Math.min(Math.max(point.y, 0), page.height),
  };
}

interface Drag {
  pointerId: number;
  startX: number;
  startY: number;
  origin: Point;
}

/** The number drawn on top of the page, where and how the PDF output prints it. */
export function StampOverlay({ info, placement, visible, text, label, onMove }: StampOverlayProps) {
  const theme = useTheme();
  const { pageSize, scale } = info;
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<Drag | null>(null);
  const [dragging, setDragging] = useState(false);
  const [focused, setFocused] = useState(false);
  const metrics = measureText(text, placement.font, placement.font_size);
  const move = (point: Point) => onMove(clampToPage(point, pageSize));

  // Escape anywhere cancels a drag in progress.
  useEffect(() => {
    if (!dragging) return;
    const cancel = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape" || !drag.current) return;
      onMove(drag.current.origin);
      drag.current = null;
      setDragging(false);
    };
    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, [dragging, onMove]);

  function placeAtClick(clientX: number, clientY: number) {
    const rect = svg.current?.getBoundingClientRect() ?? { left: 0, top: 0 };
    const clicked = toPoints(
      { left: clientX - rect.left, top: clientY - rect.top },
      pageSize,
      scale,
    );
    move({ x: clicked.x - metrics.width / 2, y: clicked.y - metrics.ascent / 2 });
  }

  function onPointerDown(event: PointerEvent<SVGGElement>) {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: { x: placement.x, y: placement.y },
    };
    setDragging(true);
  }

  function onPointerMove(event: PointerEvent<SVGGElement>) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const origin = toPixels(current.origin, pageSize, scale);
    move(
      toPoints(
        {
          left: origin.left + event.clientX - current.startX,
          top: origin.top + event.clientY - current.startY,
        },
        pageSize,
        scale,
      ),
    );
  }

  function endDrag(event: PointerEvent<SVGGElement>, cancelled: boolean) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (cancelled) onMove(current.origin);
    drag.current = null;
    setDragging(false);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }

  function onKeyDown(event: KeyboardEvent<SVGGElement>) {
    const step = event.shiftKey ? 10 : 1;
    const deltas: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };
    const delta = deltas[event.key];
    if (!delta) return;
    event.preventDefault();
    event.stopPropagation();
    move({ x: placement.x + delta[0], y: placement.y + delta[1] });
  }

  const anchor = toPixels(placement, pageSize, scale);
  const accent = theme.palette.primary.main;

  return (
    <svg
      ref={svg}
      data-testid="stamp-overlay"
      width="100%"
      height="100%"
      style={{ position: "absolute", inset: 0, overflow: "visible" }}
    >
      <rect
        data-testid="placement-surface"
        width="100%"
        height="100%"
        fill="transparent"
        style={{ cursor: "crosshair" }}
        onClick={(event) => placeAtClick(event.clientX, event.clientY)}
      />
      {visible && (
        <g
          role="button"
          aria-roledescription="movable number"
          aria-label={label}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(event) => endDrag(event, false)}
          onPointerCancel={(event) => endDrag(event, true)}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{ cursor: dragging ? "grabbing" : "grab", touchAction: "none", outline: "none" }}
        >
          <rect
            x={anchor.left - PAD_PX}
            y={anchor.top - metrics.ascent * scale - PAD_PX}
            width={metrics.width * scale + 2 * PAD_PX}
            height={metrics.ascent * scale + 2 * PAD_PX}
            rx={2}
            fill={alpha(accent, dragging ? 0.16 : 0.08)}
            stroke={accent}
            strokeWidth={focused || dragging ? 2 : 1}
            strokeDasharray={focused || dragging ? undefined : "4 3"}
          />
          <text
            x={anchor.left}
            y={anchor.top}
            fontFamily={`"${fontFamily(placement.font)}", serif`}
            fontSize={placement.font_size * scale}
            fill="#000"
            style={{ userSelect: "none", whiteSpace: "pre" }}
          >
            {text}
          </text>
        </g>
      )}
    </svg>
  );
}
