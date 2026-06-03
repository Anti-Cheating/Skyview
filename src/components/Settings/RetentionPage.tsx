import { Box, Typography, Alert } from '@mui/material';

export default function RetentionPage() {
  return (
    <Box>
      <Typography variant="h5" gutterBottom>Retention</Typography>
      <Alert severity="info">
        Retention windows (7 / 30 / 90 / 365 days) are stored on{' '}
        <code>companies.retention_days</code>. UI editor + purge cron ship in V1.1.
      </Alert>
    </Box>
  );
}
