import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { strings } from "../strings";

export function WorkspaceScreen() {
  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <Typography variant="h5" component="h1">
        {strings.workspace.title}
      </Typography>
    </Box>
  );
}
