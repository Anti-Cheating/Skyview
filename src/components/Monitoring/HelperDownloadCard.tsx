/**
 * HelperDownloadCard — shown when the Trueyy Helper daemon is not
 * reachable on 127.0.0.1:48123. The user hasn't installed it yet (or
 * it's not running). Gives them the OS-appropriate download with the
 * OS logo — a single Mac (Apple Silicon / arm64) build and a single
 * Windows (x64) build.
 *
 * mode="update": the helper IS installed but confirmed older than the
 * published release and its silent self-update hasn't landed — same
 * buttons (Cortex's /downloads/helper/* always 302s to the newest pkg),
 * different copy.
 */

import type { ReactNode } from 'react';
import { Box, CircularProgress } from '@mui/material';
import {
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Apple as AppleIcon,
  Microsoft as WindowsIcon,
} from '@mui/icons-material';
import { getHelperDownloadUrl, detectHelperPlatform } from '../../services/helperBridge';
import { TOKENS } from '../../theme';
import { CardTitle, Secondary, Caption } from '../layout/Typography';
import { ActionButton } from '../common/ActionButton';

type DownloadOption = { label: string; url: string; icon: ReactNode };

const BRAND = TOKENS.brand;
const LIGHT_BG = TOKENS.bgCard;
const LIGHT_BORDER = TOKENS.border;

interface Props {
  /** True when the hook is still polling /health the first time */
  checking?: boolean;
  /** Force-refresh the health check. Used by the "Retry detection" button. */
  onRetry?: () => void;
  /** 'install' (default) = helper missing; 'update' = installed but outdated. */
  mode?: 'install' | 'update';
  /** Newest published version — shown in the update copy when known. */
  latestVersion?: string | null;
}

export default function HelperDownloadCard({ checking, onRetry, mode = 'install', latestVersion }: Props) {
  const platform = detectHelperPlatform();
  const updating = mode === 'update';

  // Only an arm64 (Apple Silicon) macOS build is published, so macOS gets a
  // single download button. Windows is a single x64 build. Unknown OS → offer
  // both platforms' builds.
  const win: DownloadOption = {
    label: 'Download for Windows',
    url: getHelperDownloadUrl('windows'),
    icon: <WindowsIcon sx={{ fontSize: 16 }} />,
  };
  const mac: DownloadOption = {
    label: 'Download for Mac',
    url: getHelperDownloadUrl('mac', 'arm64'),
    icon: <AppleIcon sx={{ fontSize: 16 }} />,
  };
  const options: DownloadOption[] =
    platform === 'windows' ? [win]
    : platform === 'mac'   ? [mac]
    : [win, { ...mac, label: 'Download for Mac' }];

  const HeaderIcon = platform === 'mac' ? AppleIcon : platform === 'windows' ? WindowsIcon : DownloadIcon;

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
          <HeaderIcon sx={{ fontSize: 22 }} />
        </Box>

        {/* Section heading rendered as a real <h2>. The page-level
            <h1> already exists in MonitoringView (or CandidateJoinPage's
            header), and this card is a section under it. */}
        <CardTitle component="h2" sx={{ m: 0, mb: 0.75 }}>
          {updating ? 'Update Trueyy Helper' : 'Install Trueyy Helper'}
        </CardTitle>
        <Secondary sx={{ color: TOKENS.textSecondary, mb: 2 }}>
          {updating ? (
            <>
              A newer version of the monitoring app
              {latestVersion ? ` (v${latestVersion})` : ''} is required for this
              interview. It usually updates itself within a few seconds. If this
              message stays, download and run the installer again.
            </>
          ) : (
            <>
              Install the desktop app that runs monitoring for this interview. It’s a
              one-time setup. Future interviews connect automatically.
            </>
          )}
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
          {options.map((opt) => (
            <ActionButton
              key={opt.label}
              startIcon={opt.icon}
              href={opt.url}
            >
              {opt.label}
            </ActionButton>
          ))}
          {onRetry && (
            <ActionButton
              variant="secondary"
              startIcon={<RefreshIcon sx={{ fontSize: 16 }} />}
              onClick={onRetry}
            >
              Retry detection
            </ActionButton>
          )}
        </Box>

        <Caption sx={{ display: 'block', color: TOKENS.textMuted, mt: 1.5 }}>
          {updating ? 'Already updated it? Click ' : 'Already installed it? Click '}
          <Box component="span" sx={{ fontWeight: 600, color: TOKENS.textSecondary }}>Retry detection</Box>.
        </Caption>
      </Box>
    </Box>
  );
}
