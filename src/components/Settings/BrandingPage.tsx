import { Box, Typography, Alert } from '@mui/material';

export default function BrandingPage() {
  // Branding writes (logo + color) plumb through a future PATCH /api/companies/me
  // endpoint not yet implemented in V1. This page exists so the SettingsLayout
  // sidebar link doesn't 404.
  return (
    <Box>
      <Typography variant="h5" gutterBottom>Branding</Typography>
      <Alert severity="info">
        Branding configuration (logo + primary color) is part of SP-6 V1.1. The schema
        columns <code>branding_color</code> and <code>logo_url</code> exist on{' '}
        <code>companies</code>; UI to edit them ships in the next iteration.
      </Alert>
    </Box>
  );
}
