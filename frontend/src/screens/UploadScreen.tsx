import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";

import { strings } from "../strings";

export function UploadScreen() {
  return (
    <Container maxWidth="md" sx={{ py: { xs: 3, sm: 6 } }}>
      <Typography variant="h4" component="h1" gutterBottom>
        {strings.upload.title}
      </Typography>
      <Typography variant="body1" color="text.secondary">
        {strings.tagline}
      </Typography>
    </Container>
  );
}
