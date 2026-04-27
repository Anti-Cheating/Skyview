/**
 * InterviewerSetupCard — 2-step vertical stepper for interviewer setup.
 * Visual mirror of CandidateJoinPage's StepRow layout, applied to the
 * interviewer's mic-only flow.
 *
 * Steps:
 *   1. Install Extension — detected via ping
 *   2. Enable Microphone — native helper mic permission
 */

import { useState } from 'react';
import { Box, Button, CircularProgress } from '@mui/material';
import { ActionButton } from '../common/ActionButton';
import {
  Extension as ExtensionIcon,
  Mic as MicIcon,
} from '@mui/icons-material';
import { TOKENS } from '../../theme';
import StepRow from '../common/StepRow';
import { detectHelperPlatform } from '../../services/helperBridge';
import { Secondary } from '../layout/Typography';

const IS_WINDOWS = detectHelperPlatform() === 'windows';
const SETTINGS_APP_NAME = IS_WINDOWS ? 'Windows Settings' : 'System Settings';
const MIC_PATH        = IS_WINDOWS ? 'Privacy & security → Microphone' : 'Microphone';

const BRAND = TOKENS.brand;
const LIGHT_BG = TOKENS.bgCard;
const LIGHT_BORDER = TOKENS.border;

export interface InterviewerStepperProps {
  installed: boolean;
  micGranted: boolean;
  checking: boolean;
  onEnableMic?: () => void;
  onRetryMic?: () => void;
}

export default function InterviewerSetupCard({
  installed,
  micGranted,
  checking,
  onEnableMic,
  onRetryMic,
}: InterviewerStepperProps) {
  const [micClicked, setMicClicked] = useState(false);

  const extensionState = checking
    ? 'checking'
    : installed
    ? 'done'
    : 'missing';
  const micState = !installed
    ? 'pending'
    : micGranted
    ? 'done'
    : micClicked
    ? 'denied'
    : 'pending';

  return (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        pt: { xs: 3, md: 6 },
        px: { xs: 2, md: 3 },
        pb: 3,
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
        }}
      >
        {/* Step 1 — Install Extension */}
        <StepRow
          number={1}
          icon={<ExtensionIcon sx={{ fontSize: 18 }} />}
          title="Install Extension"
          done={extensionState === 'done'}
          active={extensionState !== 'done'}
          first
        >
          {extensionState === 'checking' && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={12} sx={{ color: BRAND }} />
              <Secondary sx={{ color: TOKENS.textSecondary }}>Detecting...</Secondary>
            </Box>
          )}
          {extensionState === 'done' && (
            <Secondary sx={{ color: TOKENS.success }}>
              Trueyy Interviewer Monitor detected
            </Secondary>
          )}
          {extensionState === 'missing' && (
            <>
              <Secondary sx={{ color: TOKENS.error, mb: 0.75 }}>
                Extension not found
              </Secondary>
              <Button
                size="small"
                variant="text"
                onClick={() => window.location.reload()}
                sx={{
                  p: 0,
                  minWidth: 0,
                  color: BRAND,
                  '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
                }}
              >
                Reload page
              </Button>
            </>
          )}
        </StepRow>

        {/* Step 2 — Enable Microphone */}
        <StepRow
          number={2}
          icon={<MicIcon sx={{ fontSize: 18 }} />}
          title="Enable Microphone"
          done={micState === 'done'}
          active={extensionState === 'done' && micState !== 'done'}
          last
        >
          {micState === 'pending' && extensionState === 'done' && (
            <>
              <Secondary sx={{ color: TOKENS.textSecondary, mb: 1 }}>
                Grants microphone access to Trueyy Helper for live transcription
              </Secondary>
              <ActionButton
                onClick={() => {
                  setMicClicked(true);
                  onEnableMic?.();
                }}
              >
                Enable Microphone
              </ActionButton>
            </>
          )}
          {micState === 'done' && (
            <Secondary sx={{ color: TOKENS.success }}>
              Microphone granted
            </Secondary>
          )}
          {micState === 'denied' && (
            <>
              <Secondary sx={{ color: TOKENS.textSecondary, mb: 0.5 }}>
                Enable <strong>Trueyy Helper</strong> in {SETTINGS_APP_NAME} → {MIC_PATH}, then Try Again.
              </Secondary>
              <Box sx={{ display: 'flex', gap: 0.75, mt: 0.5 }}>
                <ActionButton onClick={onEnableMic}>
                  Open Settings
                </ActionButton>
                <ActionButton variant="secondary" onClick={onRetryMic}>
                  Try Again
                </ActionButton>
              </Box>
            </>
          )}
        </StepRow>

      </Box>
    </Box>
  );
}
