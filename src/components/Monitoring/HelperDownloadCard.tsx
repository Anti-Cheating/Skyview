/**
 * HelperDownloadCard — shown when the Trueyy Helper daemon is not
 * reachable on 127.0.0.1:48123. The user hasn't installed it yet (or
 * it's not running). Gives them the single-button download.
 */

import { Box, Button, CircularProgress } from '@mui/material';
import {
  Download as DownloadIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { getHelperDownloadUrl, detectHelperPlatform } from '../../services/helperBridge';
import { TOKENS } from '../../theme';
import { CardTitle, Secondary, Caption } from '../layout/Typography';

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

        <CardTitle sx={{ mb: 0.75 }}>
          Install Trueyy Helper
        </CardTitle>
        <Secondary sx={{ color: TOKENS.textSecondary, mb: 2 }}>
          Trueyy Helper is a small background app that captures your microphone and activity
          during the interview. Install it once — all future interviews work automatically.
        </Secondary>

        {checking ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <CircularProgress size={14} sx={{ color: BRAND }} />
            <Secondary sx={{ color: TOKENS.textSecondary }}>
              Checking if Trueyy Helper is already installed…
            </Secondary>
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
                color: TOKENS.textSecondary,
                borderColor: '#D1D5DB',
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

        <Caption sx={{ display: 'block', color: TOKENS.textMuted, mt: 1.5 }}>
          Already installed? The helper should be reachable at{' '}
          <code>http://127.0.0.1:48123</code>. Open this URL in a new
          tab — if it returns JSON the helper is running. Otherwise install and refresh.
        </Caption>
      </Box>
    </Box>
  );
}
