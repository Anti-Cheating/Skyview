/**
 * Extension Authorize page — Claude-CLI-style consent screen.
 *
 * Flow:
 *   1. The Jarvis extension's side panel opens this page in a new tab
 *      (`/authorize-extension?ext=jarvis&extId=<id>`)
 *   2. PrivateRoute ensures the user is logged in to Skyview first; if
 *      not, it sends them to /login?returnTo=<this URL>
 *   3. Once authenticated, this component renders a "Trueyy Candidate
 *      Monitor wants to access your account" consent UI with an
 *      Authorize / Cancel button pair
 *   4. On Authorize → token is shipped to the extension via
 *      chrome.runtime.sendMessage → success screen → user closes the tab
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Extension as ExtensionIcon,
  Lock as LockIcon,
  Visibility as EyeIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import { sendAuthToExtension } from '../../services/extensionBridge';

export default function ExtensionAuthorize() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  // The extension passes ?ext=jarvis so this page knows it's the right flow.
  // If someone navigates here directly without it, bounce them to dashboard.
  const isExtFlow = params.get('ext') === 'jarvis';

  useEffect(() => {
    if (!isExtFlow) {
      navigate('/', { replace: true });
    }
  }, [isExtFlow, navigate]);

  if (!isExtFlow) return null;

  const handleAuthorize = async () => {
    if (!user) return;
    setBusy(true);
    setError('');
    try {
      await sendAuthToExtension(user);
      setDone(true);
    } catch (err: any) {
      setError(
        err?.message ||
          'Could not reach the Trueyy extension. Make sure it is installed, then try again.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = () => {
    // Try to close the tab; if the browser blocks (tab not opened by script),
    // fall back to dashboard.
    window.close();
    setTimeout(() => navigate('/'), 200);
  };

  const handleSwitchAccount = async () => {
    await logout();
    // After logout PrivateRoute will redirect to /login with returnTo back here
  };

  // ─── Success state ──────────────────────────────────────────────────
  if (done) {
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
        <Container maxWidth="xs">
          <Box
            sx={{
              p: 4,
              borderRadius: '12px',
              bgcolor: '#122318',
              border: '1px solid rgba(76, 217, 100, 0.12)',
              textAlign: 'center',
            }}
          >
            <CheckIcon sx={{ fontSize: 56, color: '#4CD964', mb: 2 }} />
            <Typography variant="h6" sx={{ color: '#FFFFFF', fontWeight: 700, mb: 1 }}>
              Extension authorized
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: 'rgba(255,255,255,0.7)', mb: 3 }}
            >
              The Trueyy Candidate Monitor extension is now connected to your
              account. You can close this tab and return to your browser.
            </Typography>
            <Button
              onClick={() => window.close()}
              variant="contained"
              fullWidth
              sx={{
                bgcolor: '#4CD964',
                color: '#0B1A10',
                fontWeight: 600,
                borderRadius: '8px',
                '&:hover': { bgcolor: '#3CB853' },
              }}
            >
              Close this tab
            </Button>
          </Box>
        </Container>
      </Box>
    );
  }

  // ─── Consent screen ─────────────────────────────────────────────────
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
      <Container maxWidth="sm">
        <Box
          sx={{
            p: 4,
            borderRadius: '12px',
            bgcolor: '#122318',
            border: '1px solid rgba(76, 217, 100, 0.12)',
          }}
        >
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: '14px',
                bgcolor: 'rgba(76, 217, 100, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <ExtensionIcon sx={{ fontSize: 30, color: '#4CD964' }} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="h6"
                sx={{ color: '#FFFFFF', fontWeight: 700, lineHeight: 1.3 }}
              >
                Authorize Trueyy Extension
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: 'rgba(255,255,255,0.6)', mt: 0.25 }}
              >
                Trueyy Candidate Monitor wants to access your account
              </Typography>
            </Box>
          </Box>

          {/* Signed-in-as pill */}
          {user && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                p: 1.5,
                borderRadius: '10px',
                bgcolor: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                mb: 3,
              }}
            >
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  bgcolor: '#4CD964',
                  color: '#0B1A10',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  flexShrink: 0,
                }}
              >
                {(user.first_name?.[0] || user.email?.[0] || 'U').toUpperCase()}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  sx={{
                    color: '#FFFFFF',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    lineHeight: 1.3,
                  }}
                >
                  Signed in as{' '}
                  {[user.first_name, user.last_name].filter(Boolean).join(' ') ||
                    user.email}
                </Typography>
                <Typography
                  sx={{
                    color: 'rgba(255,255,255,0.55)',
                    fontSize: '0.75rem',
                  }}
                >
                  {user.email}
                </Typography>
              </Box>
              <Button
                onClick={handleSwitchAccount}
                size="small"
                sx={{
                  textTransform: 'none',
                  color: 'rgba(255,255,255,0.6)',
                  fontSize: '0.75rem',
                  '&:hover': { color: '#4CD964', bgcolor: 'rgba(76,217,100,0.06)' },
                }}
              >
                Switch
              </Button>
            </Box>
          )}

          {/* Permissions list */}
          <Typography
            sx={{
              color: 'rgba(255,255,255,0.7)',
              fontSize: '0.813rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              mb: 1.5,
            }}
          >
            This will allow the extension to:
          </Typography>
          <Box sx={{ mb: 3 }}>
            <PermissionRow
              icon={<PersonIcon sx={{ fontSize: 16 }} />}
              title="Access your account"
              desc="Use your Trueyy login to identify which interview you're joining"
            />
            <PermissionRow
              icon={<EyeIcon sx={{ fontSize: 16 }} />}
              title="Receive interview sessions"
              desc="Be notified when you click Join on an interview from Skyview"
            />
            <PermissionRow
              icon={<LockIcon sx={{ fontSize: 16 }} />}
              title="Request monitoring permission"
              desc="Ask you to enable monitoring at the start of each interview"
            />
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: '8px' }}>
              {error}
            </Alert>
          )}

          {/* Actions */}
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button
              onClick={handleCancel}
              disabled={busy}
              fullWidth
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                color: 'rgba(255,255,255,0.7)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '8px',
                py: 1,
                '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAuthorize}
              disabled={busy || !user}
              variant="contained"
              fullWidth
              startIcon={busy ? <CircularProgress size={16} color="inherit" /> : null}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                bgcolor: '#4CD964',
                color: '#0B1A10',
                borderRadius: '8px',
                py: 1,
                '&:hover': { bgcolor: '#3CB853' },
                '&.Mui-disabled': {
                  bgcolor: 'rgba(76, 217, 100, 0.15)',
                  color: 'rgba(255,255,255,0.3)',
                },
              }}
            >
              {busy ? 'Authorizing…' : 'Authorize'}
            </Button>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}

function PermissionRow({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1.5,
        py: 1,
        '& + &': { borderTop: '1px solid rgba(255,255,255,0.06)' },
      }}
    >
      <Box
        sx={{
          width: 28,
          height: 28,
          borderRadius: '6px',
          bgcolor: 'rgba(76, 217, 100, 0.12)',
          color: '#4CD964',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          mt: 0.25,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ color: '#FFFFFF', fontSize: '0.875rem', fontWeight: 600 }}>
          {title}
        </Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.75rem' }}>
          {desc}
        </Typography>
      </Box>
    </Box>
  );
}
