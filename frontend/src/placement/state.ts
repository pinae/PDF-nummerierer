import type { NumberFormat, PageRole, Placement, Placements } from "../api/types";
import { mmToPt } from "../pdf/coordinates";
import { firstPageOfRole } from "../pdf/pages";
import { measureText } from "./measure";
import { presetPoint } from "./presets";
import { formatSerial } from "./serial";

/** Everything that decides where and how numbers are printed (a config without its name). */
export interface StampSettings {
  number_format: NumberFormat;
  placements: Placements;
}

export interface EditorState {
  config: StampSettings;
  /** Last placement of each page type, restored when it is switched on again. */
  remembered: Record<PageRole, Placement>;
}

export type EditorAction =
  | { type: "move"; role: PageRole; x: number; y: number }
  | { type: "set"; role: PageRole; placement: Placement }
  | { type: "enable"; role: PageRole; enabled: boolean }
  | { type: "style"; role: PageRole; font?: string; font_size?: number }
  | { type: "applyToAll"; role: PageRole }
  | { type: "load"; config: StampSettings };

export const ROLES: PageRole[] = ["first", "odd", "even"];
export const DEFAULT_FONT = "cmu-serif";
export const DEFAULT_SIZE = 12;
export const DEFAULT_MARGIN = mmToPt(10);
/** The backend accepts coordinates up to the largest possible PDF page. */
const MAX_COORDINATE = 14400;
/** The number shown in the preview. */
export const PREVIEW_NUMBER = 1;

const clamp = (value: number) => Math.min(Math.max(value, 0), MAX_COORDINATE);

export function initialEditorState(pageSizes: [number, number][]): EditorState {
  const numberFormat: NumberFormat = { prefix: "", digits: 4, suffix: "" };
  const metrics = measureText(
    formatSerial(numberFormat, PREVIEW_NUMBER),
    DEFAULT_FONT,
    DEFAULT_SIZE,
  );
  const placementFor = (role: PageRole): Placement => {
    const [width, height] = pageSizes[(firstPageOfRole(role, pageSizes.length) ?? 1) - 1] ?? [
      595.28, 841.89,
    ];
    const point = presetPoint("top-right", { width, height }, metrics, DEFAULT_MARGIN);
    return { ...point, font: DEFAULT_FONT, font_size: DEFAULT_SIZE };
  };
  const placements = {
    first: placementFor("first"),
    odd: placementFor("odd"),
    even: placementFor("even"),
  };
  return { config: { number_format: numberFormat, placements }, remembered: { ...placements } };
}

function withPlacement(
  state: EditorState,
  role: PageRole,
  placement: Placement | null,
): EditorState {
  return {
    config: { ...state.config, placements: { ...state.config.placements, [role]: placement } },
    remembered: placement ? { ...state.remembered, [role]: placement } : state.remembered,
  };
}

export function placementReducer(state: EditorState, action: EditorAction): EditorState {
  const current = (role: PageRole) => state.config.placements[role] ?? state.remembered[role];
  switch (action.type) {
    case "move":
      return withPlacement(state, action.role, {
        ...current(action.role),
        x: clamp(action.x),
        y: clamp(action.y),
      });
    case "set":
      return withPlacement(state, action.role, action.placement);
    case "enable":
      return withPlacement(state, action.role, action.enabled ? current(action.role) : null);
    case "style":
      return withPlacement(state, action.role, {
        ...current(action.role),
        ...(action.font !== undefined && { font: action.font }),
        ...(action.font_size !== undefined && { font_size: action.font_size }),
      });
    case "applyToAll": {
      const source = current(action.role);
      return ROLES.reduce((next, role) => withPlacement(next, role, { ...source }), state);
    }
    case "load": {
      const remembered = { ...state.remembered };
      for (const role of ROLES) {
        const placement = action.config.placements[role];
        if (placement) remembered[role] = placement;
      }
      return { config: action.config, remembered };
    }
  }
}
