import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Typography, Alert, CircularProgress, Link } from '@mui/material';
import { Logout as LogoutIcon, Launch as LaunchIcon } from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import { AuthService } from '../../services/auth.service';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleOpenInFalcon = async () => {
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      // Get the desktop code from Cortex
      const { code } = await AuthService.getDesktopCode();

      // Construct the deep link
      const deepLink = `falcon://auth?code=${encodeURIComponent(code)}`;

      // Try to open Falcon via the deep link
      window.location.href = deepLink;

      // Show success message
      setSuccessMessage('Redirecting you back to the desktop app...');
    } catch (err: any) {
      setError(err.message || 'Failed to generate deep link for Falcon');
      console.error('Open in Falcon error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: 2,
      }}
    >
      <Box
        sx={{
          maxWidth: 600,
          width: '100%',
          p: 4,
          borderRadius: '12px',
          bgcolor: '#122318',
          border: '1px solid rgba(76, 217, 100, 0.12)',
        }}
      >
        <Typography variant="h4" fontWeight="bold" sx={{ color: '#FFFFFF', mb: 1 }}>
          You're signed in
        </Typography>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', mb: 3 }}>
          Return to the Trueyy desktop app to continue
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: '8px' }}>
            {error}
          </Alert>
        )}

        {successMessage && (
          <Alert severity="success" sx={{ mb: 2, borderRadius: '8px' }}>
            {successMessage}
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Button
            variant="contained"
            fullWidth
            startIcon={loading ? <CircularProgress size={20} /> : <LaunchIcon />}
            onClick={handleOpenInFalcon}
            disabled={loading}
            sx={{
              bgcolor: '#4CD964',
              color: '#0B1A10',
              fontWeight: 600,
              borderRadius: '8px',
              py: 1.5,
              '&:hover': { bgcolor: '#3CB853' },
              '&.Mui-disabled': {
                backgroundColor: 'rgba(76, 217, 100, 0.15) !important',
                color: 'rgba(255,255,255,0.3) !important',
              },
            }}
          >
            {loading ? 'Redirecting to app...' : 'Open Desktop App'}
          </Button>

          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
            Don't have the app installed?{' '}
            <Link
              href="https://github.com/yourusername/falcon/releases"
              target="_blank"
              sx={{
                color: '#4CD964',
                textDecoration: 'none',
                fontWeight: 600,
                '&:hover': { textDecoration: 'underline' },
              }}
            >
              Download Trueyy
            </Link>
          </Typography>

          <Button
            variant="outlined"
            fullWidth
            startIcon={<LogoutIcon />}
            onClick={handleLogout}
            disabled={loading}
            sx={{
              borderColor: 'rgba(255,255,255,0.3)',
              color: 'rgba(255,255,255,0.8)',
              fontWeight: 600,
              borderRadius: '8px',
              py: 1.5,
              '&:hover': {
                borderColor: 'rgba(255,255,255,0.5)',
                bgcolor: 'rgba(255,255,255,0.05)',
              },
            }}
          >
            Sign Out
          </Button>
        </Box>

        <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid rgba(76, 217, 100, 0.1)' }}>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block' }}>
            User ID: {user?.id}
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block', mt: 0.5 }}>
            Joined: {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
