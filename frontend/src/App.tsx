import Container from "@mui/material/Container";
import CssBaseline from "@mui/material/CssBaseline";
import Typography from "@mui/material/Typography";

export default function App() {
  return (
    <>
      <CssBaseline />
      <Container component="main" maxWidth="md" sx={{ py: 6 }}>
        <Typography variant="h3" component="h1" gutterBottom>
          PDF-Nummerierer
        </Typography>
        <Typography variant="body1">
          Stamp serial numbers onto exam PDFs, so pages of different students can never be mixed up.
        </Typography>
      </Container>
    </>
  );
}
