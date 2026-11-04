import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";

import { strings } from "../strings";

export function DoneScreen() {
  return (
    <Container maxWidth="sm" sx={{ py: { xs: 3, sm: 6 } }}>
      <Typography variant="h4" component="h1">
        {strings.done.title}
      </Typography>
    </Container>
  );
}
