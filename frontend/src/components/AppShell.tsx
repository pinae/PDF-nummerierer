import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Toolbar from "@mui/material/Toolbar";
import { Outlet, Link as RouterLink } from "react-router";

import { strings } from "../strings";

export function AppShell() {
  return (
    // Fixed height: the header stays put, <main> scrolls, and the workspace can
    // fill exactly the remaining space (its preview scrolls by itself).
    <Box sx={{ height: "100dvh", display: "flex", flexDirection: "column" }}>
      <AppBar
        position="static"
        color="primary"
        elevation={0}
        sx={{ borderBottom: 1, borderColor: "divider" }}
      >
        <Toolbar>
          <Link
            component={RouterLink}
            to="/"
            color="inherit"
            underline="none"
            variant="h6"
            sx={{ fontWeight: 600 }}
          >
            {strings.appName}
          </Link>
        </Toolbar>
      </AppBar>
      <Box
        component="main"
        sx={{ flex: 1, minHeight: 0, overflow: "auto", display: "flex", flexDirection: "column" }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}
