/**
 * HelperDownloadCard — shown when the Trueyy Helper daemon is not
 * reachable on 127.0.0.1:48123. The user hasn't installed it yet (or
 * it's not running). Gives them the single-button download.
 *
 * Replaces the "Extension not found" copy that used to appear when
 * the candidate/interviewer extension wasn't installed.
 */

import { Box, Typography, Button, CircularProgress } from '@mui/material';
import {
  Download as DownloadIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { getHelperDownloadUrl, detectHelperPlatform } from '../../services/helperBridge';
import { TOKENS } from '../../theme';

const BRAND = TOKENS.brand;
const LIGHT_BG = TOKENS.bgCard;
const LIGHT_BORDER = TOKENS.border;

interface Props {
  /** True when the hook is still polling /health the first time */
  checking?: boolean;
  /** Force-refresh the health check. Used by the "Retry detection" button. */
  onRetry?: () => void;
}

export default function HelperDownloadCard({ checking, onRetry }: Props) {
  const platform = detectHelperPlatform();
  const url = getHelperDownloadUrl(platform);
  const downloadLabel =
    platform === 'windows' ? 'Download for Windows'
    : platform === 'mac'    ? 'Download for macOS'
    :                         'Download installer';

  return (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        pt: { xs: 3, md: 6 },
        px: { xs: 2, md: 3 },
      }}
    >
      <Box
        sx={{
          width: 460,
          maxWidth: '100%',
          bgcolor: LIGHT_BG,
          borderRadius: '12px',
          border: `1px solid ${LIGHT_BORDER}`,
          boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
          p: 3,
        }}
      >
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: '10px',
            bgcolor: 'rgba(76, 217, 100, 0.12)',
            color: '#047857',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 1.5,
          }}
        >
          <DownloadIcon sx={{ fontSize: 22 }} />
        </Box>

        <Typography sx={{ fontSize: '1.05rem', fontWeight: 700, color: '#1F2937', mb: 0.75 }}>
          Install Trueyy Helper
        </Typography>
        <Typography sx={{ fontSize: '0.85rem', color: '#6B7280', lineHeight: 1.6, mb: 2 }}>
          Trueyy Helper is a small background app that captures your microphone and activity
          during the interview. Install it once — all future interviews work automatically.
        </Typography>

        {checking ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <CircularProgress size={14} sx={{ color: BRAND }} />
            <Typography sx={{ fontSize: '0.8rem', color: '#6B7280' }}>
              Checking if Trueyy Helper is already installed…
            </Typography>
          </Box>
        ) : null}

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            href={url}
            sx={{
              bgcolor: BRAND,
              color: '#fff',
              textTransform: 'none',
              fontSize: '0.85rem',
              fontWeight: 600,
              py: 0.75,
              px: 2.5,
              borderRadius: '8px',
              '&:hover': { bgcolor: '#3CB853' },
              boxShadow: 'none',
            }}
          >
            {downloadLabel}
          </Button>
          {onRetry && (
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={onRetry}
              sx={{
                color: '#6B7280',
                borderColor: '#D1D5DB',
                textTransform: 'none',
                fontSize: '0.85rem',
                fontWeight: 600,
                py: 0.75,
                px: 2,
                borderRadius: '8px',
                '&:hover': { bgcolor: '#F9FAFB', borderColor: '#9CA3AF' },
              }}
            >
              Retry detection
            </Button>
          )}
        </Box>

        <Typography sx={{ fontSize: '0.7rem', color: '#9CA3AF', mt: 1.5 }}>
          Already installed? The helper should be reachable at{' '}
          <code style={{ fontSize: '0.72rem' }}>http://127.0.0.1:48123</code>. Open this URL in a new
          tab — if it returns JSON the helper is running. Otherwise install and refresh.
        </Typography>
      </Box>
    </Box>
  );
}
