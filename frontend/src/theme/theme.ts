import { createTheme } from "@mui/material/styles";
import type {} from "@mui/material/themeCssVarsAugmentation";

/**
 * Light and dark palettes; the browser's prefers-color-scheme picks one through
 * a CSS media query (no JavaScript, no flash, follows OS changes live).
 * Style dark variants with theme.applyStyles("dark", ...), never palette.mode.
 */
export const theme = createTheme({
  cssVariables: { colorSchemeSelector: "media" },
  colorSchemes: { light: true, dark: true },
  typography: {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
});
