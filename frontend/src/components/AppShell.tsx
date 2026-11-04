import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Toolbar from "@mui/material/Toolbar";
import { Outlet, Link as RouterLink } from "react-router";

import { strings } from "../strings";

export function AppShell() {
  return (
    <Box sx={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
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
      <Box component="main" sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <Outlet />
      </Box>
    </Box>
  );
}
