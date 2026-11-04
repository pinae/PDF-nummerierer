import KeyboardArrowDown from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowLeft from "@mui/icons-material/KeyboardArrowLeft";
import KeyboardArrowRight from "@mui/icons-material/KeyboardArrowRight";
import KeyboardArrowUp from "@mui/icons-material/KeyboardArrowUp";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import ListSubheader from "@mui/material/ListSubheader";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useId, type Dispatch } from "react";

import type { FontCategory, FontInfo, PageRole, Placement } from "../api/types";
import { NumberField } from "../components/NumberField";
import { mmToPt, ptToMm, type Size } from "../pdf/coordinates";
import { strings } from "../strings";
import { fontFamily } from "./fonts";
import { measureText } from "./measure";
import { PRESET_ANCHORS, presetPoint, type PresetAnchor } from "./presets";
import type { EditorAction } from "./state";

const text = strings.placement;
const CATEGORIES: FontCategory[] = ["serif", "sans-serif", "handwritten"];
const MAX_MM = ptToMm(14400);

export interface PlacementToolsProps {
  role: PageRole;
  placement: Placement;
  enabled: boolean;
  fonts: FontInfo[];
  pageSize: Size;
  stampText: string;
  marginMm: number;
  onMarginChange: (mm: number) => void;
  /** Called when the font menu opens, to load all fonts for their previews. */
  onFontMenuOpen?: () => void;
  dispatch: Dispatch<EditorAction>;
}

function PresetGrid({ onPick }: { onPick: (anchor: PresetAnchor) => void }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 40px)",
        gridTemplateRows: "repeat(3, 40px)",
        gap: 0.5,
        p: 0.5,
        border: 1,
        borderColor: "divider",
        borderRadius: 1,
        width: "fit-content",
      }}
    >
      {PRESET_ANCHORS.map((anchor) => (
        <Tooltip key={anchor} title={text.presets[anchor]}>
          <ButtonBase
            aria-label={text.presets[anchor]}
            onClick={() => onPick(anchor)}
            sx={{
              borderRadius: 0.5,
              "&:hover, &:focus-visible": { bgcolor: "action.hover" },
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Box sx={{ width: 14, height: 6, borderRadius: 0.5, bgcolor: "text.secondary" }} />
          </ButtonBase>
        </Tooltip>
      ))}
    </Box>
  );
}

export function PlacementTools({
  role,
  placement,
  enabled,
  fonts,
  pageSize,
  stampText,
  marginMm,
  onMarginChange,
  onFontMenuOpen,
  dispatch,
}: PlacementToolsProps) {
  const fontLabelId = useId();
  const move = (x: number, y: number) => dispatch({ type: "move", role, x, y });
  const nudge = (dx: number, dy: number) =>
    move(placement.x + mmToPt(dx), placement.y + mmToPt(dy));
  const options = fonts.length
    ? fonts
    : [{ id: placement.font, label: placement.font, category: "serif" as const, url: "" }];

  function pickPreset(anchor: PresetAnchor) {
    const metrics = measureText(stampText, placement.font, placement.font_size);
    const point = presetPoint(anchor, pageSize, metrics, mmToPt(marginMm));
    move(point.x, point.y);
  }

  return (
    <Stack spacing={2}>
      <FormControlLabel
        control={
          <Switch
            checked={enabled}
            onChange={(event) => dispatch({ type: "enable", role, enabled: event.target.checked })}
            slotProps={{ input: { role: "switch" } }}
          />
        }
        label={text.enable[role]}
      />
      {!enabled && (
        <Typography variant="body2" color="text.secondary">
          {text.disabledHint}
        </Typography>
      )}

      {enabled && (
        <>
          <Stack direction="row" spacing={1}>
            <FormControl size="small" fullWidth disabled={!fonts.length}>
              <InputLabel id={fontLabelId}>{text.font}</InputLabel>
              <Select
                labelId={fontLabelId}
                label={text.font}
                value={placement.font}
                onOpen={onFontMenuOpen}
                onChange={(event) => dispatch({ type: "style", role, font: event.target.value })}
              >
                {CATEGORIES.flatMap((category) => {
                  const inCategory = options.filter((font) => font.category === category);
                  if (!inCategory.length) return [];
                  return [
                    <ListSubheader key={`header-${category}`}>
                      {text.categories[category]}
                    </ListSubheader>,
                    ...inCategory.map((font) => (
                      <MenuItem
                        key={font.id}
                        value={font.id}
                        sx={{ fontFamily: `"${fontFamily(font.id)}", inherit` }}
                      >
                        {font.label}
                      </MenuItem>
                    )),
                  ];
                })}
              </Select>
            </FormControl>
            <Box sx={{ width: 100, flexShrink: 0 }}>
              <NumberField
                label={text.size}
                unit="pt"
                value={placement.font_size}
                min={1}
                max={200}
                step={0.5}
                format={(v) => String(v)}
                onCommit={(font_size) => dispatch({ type: "style", role, font_size })}
              />
            </Box>
          </Stack>

          <Box>
            <Typography variant="subtitle2" gutterBottom>
              {text.position}
            </Typography>
            <Stack direction="row" spacing={2} sx={{ alignItems: "center", flexWrap: "wrap" }}>
              <PresetGrid onPick={pickPreset} />
              <Stack spacing={1}>
                <Box sx={{ width: 130 }}>
                  <NumberField
                    label={text.margin}
                    unit="mm"
                    value={marginMm}
                    min={0}
                    max={200}
                    onCommit={onMarginChange}
                  />
                </Box>
                <Box role="group" aria-label={text.nudgeLabel} sx={{ display: "flex" }}>
                  <IconButton aria-label={text.nudge.left} onClick={() => nudge(-1, 0)}>
                    <KeyboardArrowLeft />
                  </IconButton>
                  <IconButton aria-label={text.nudge.up} onClick={() => nudge(0, 1)}>
                    <KeyboardArrowUp />
                  </IconButton>
                  <IconButton aria-label={text.nudge.down} onClick={() => nudge(0, -1)}>
                    <KeyboardArrowDown />
                  </IconButton>
                  <IconButton aria-label={text.nudge.right} onClick={() => nudge(1, 0)}>
                    <KeyboardArrowRight />
                  </IconButton>
                </Box>
              </Stack>
            </Stack>
          </Box>

          <Accordion disableGutters variant="outlined">
            <AccordionSummary expandIcon={<KeyboardArrowDown />}>
              {text.exactPosition}
            </AccordionSummary>
            <AccordionDetails>
              <Stack direction="row" spacing={1}>
                <NumberField
                  label={text.fromLeft}
                  unit="mm"
                  value={ptToMm(placement.x)}
                  min={0}
                  max={MAX_MM}
                  onCommit={(mm) => move(mmToPt(mm), placement.y)}
                />
                <NumberField
                  label={text.fromBottom}
                  unit="mm"
                  value={ptToMm(placement.y)}
                  min={0}
                  max={MAX_MM}
                  onCommit={(mm) => move(placement.x, mmToPt(mm))}
                />
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                {text.exactHint}
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Button variant="outlined" onClick={() => dispatch({ type: "applyToAll", role })}>
            {text.applyToAll}
          </Button>
        </>
      )}
    </Stack>
  );
}
