import KeyboardArrowDown from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUp from "@mui/icons-material/KeyboardArrowUp";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useState, type ReactNode } from "react";

/**
 * Settings beside the preview on large screens; on small screens a panel
 * below the preview that can be collapsed to give the page more room.
 */
export function ToolsPanel({
  title,
  children,
  footer,
}: {
  title: string;
  children: ReactNode;
  /** Always visible, also while the panel is collapsed on phones. */
  footer?: ReactNode;
}) {
  const theme = useTheme();
  // Asks "narrow?" so that environments without media queries (jsdom) get the
  // wide layout. On phones the panel starts collapsed to leave room for the page.
  const narrow = useMediaQuery(theme.breakpoints.down("md"), { noSsr: true });
  const wide = !narrow;
  const [open, setOpen] = useState(!narrow);
  // A column: the settings scroll in their own area and the footer is a row
  // below it, so no control can ever slide underneath the footer.
  return (
    <Box
      component="aside"
      aria-label={title}
      sx={{
        width: { md: 380 },
        flexShrink: 0,
        minHeight: 0,
        borderLeft: { md: 1 },
        borderTop: { xs: 1, md: 0 },
        // Repeated per breakpoint: the responsive border shorthand above resets the colour.
        borderColor: { xs: "divider", md: "divider" },
        bgcolor: "background.paper",
        maxHeight: { xs: "60dvh", md: "none" },
        display: "flex",
        flexDirection: "column",
      }}
    >
      {!wide && (
        <Button
          fullWidth
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          endIcon={open ? <KeyboardArrowDown /> : <KeyboardArrowUp />}
          sx={{
            justifyContent: "space-between",
            px: 2,
            py: 1,
            textTransform: "none",
            flexShrink: 0,
          }}
        >
          {title}
        </Button>
      )}
      <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        <Collapse in={wide || open}>
          <Box sx={{ p: 2 }}>{children}</Box>
        </Collapse>
      </Box>
      {footer && (
        <Box sx={{ flexShrink: 0, p: 2, borderTop: 1, borderColor: "divider" }}>{footer}</Box>
      )}
    </Box>
  );
}
