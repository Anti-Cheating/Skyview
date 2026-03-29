import { Box, CircularProgress, Typography } from '@mui/material';

interface LoadingSpinnerProps { message?: string; size?: number; fullScreen?: boolean; }

export function LoadingSpinner({ message = 'Loading...', size = 40, fullScreen = false }: LoadingSpinnerProps) {
  const content = (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <CircularProgress size={size} />
      {message && <Typography variant="body2" color="text.secondary">{message}</Typography>}
    </Box>
  );
  if (fullScreen) {
    return <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{content}</Box>;
  }
  return content;
}
