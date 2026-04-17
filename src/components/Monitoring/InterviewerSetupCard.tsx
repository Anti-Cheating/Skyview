/**
 * InterviewerSetupCard — 2-step vertical stepper for interviewer setup.
 * Visual mirror of CandidateJoinPage's StepRow layout, applied to the
 * interviewer's mic-only flow.
 *
 * Steps:
 *   1. Install Extension — detected via ping
 *   2. Enable Microphone — native helper mic permission
 *
 * Once both are done, MonitoringView hides this card and unlocks the
 * Risk Analytics panel (which itself surfaces the "Open meeting link"
 * action).
 */

import { useState } from 'react';
import { Box, Typography, Button, CircularProgress } from '@mui/material';
import {
  Extension as ExtensionIcon,
  Mic as MicIcon,
} from '@mui/icons-material';
import { TOKENS } from '../../theme';
import StepRow from '../common/StepRow';

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
              <Typography sx={{ fontSize: '0.75rem', color: '#6B7280' }}>Detecting...</Typography>
            </Box>
          )}
          {extensionState === 'done' && (
            <Typography sx={{ fontSize: '0.75rem', color: '#059669' }}>
              Trueyy Interviewer Monitor detected
            </Typography>
          )}
          {extensionState === 'missing' && (
            <>
              <Typography sx={{ fontSize: '0.75rem', color: '#DC2626', mb: 0.75 }}>
                Extension not found
              </Typography>
              <Button
                size="small"
                variant="text"
                onClick={() => window.location.reload()}
                sx={{
                  fontSize: '0.7rem',
                  textTransform: 'none',
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
              <Typography sx={{ fontSize: '0.75rem', color: '#6B7280', mb: 1 }}>
                Grants microphone access to Trueyy Helper for live transcription
              </Typography>
              <Button
                variant="contained"
                size="small"
                onClick={() => {
                  setMicClicked(true);
                  onEnableMic?.();
                }}
                sx={{
                  bgcolor: BRAND,
                  color: '#fff',
                  textTransform: 'none',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  py: 0.5,
                  px: 2,
                  borderRadius: '6px',
                  '&:hover': { bgcolor: '#3CB853' },
                  boxShadow: 'none',
                }}
              >
                Enable Microphone
              </Button>
            </>
          )}
          {micState === 'done' && (
            <Typography sx={{ fontSize: '0.75rem', color: '#059669' }}>
              Microphone granted
            </Typography>
          )}
          {micState === 'denied' && (
            <>
              <Typography sx={{ fontSize: '0.75rem', color: '#6B7280', mb: 0.5 }}>
                Enable <strong>Trueyy Helper</strong> in System Settings → Microphone, then Try Again.
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.75, mt: 0.5 }}>
                <Button
                  size="small"
                  variant="contained"
                  onClick={onEnableMic}
                  sx={{
                    bgcolor: BRAND,
                    color: '#fff',
                    textTransform: 'none',
                    fontSize: '0.688rem',
                    py: 0.25,
                    px: 1.5,
                    borderRadius: '6px',
                    '&:hover': { bgcolor: '#3CB853' },
                    boxShadow: 'none',
                  }}
                >
                  Open Settings
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={onRetryMic}
                  sx={{
                    textTransform: 'none',
                    fontSize: '0.688rem',
                    py: 0.25,
                    px: 1.5,
                    borderRadius: '6px',
                    borderColor: LIGHT_BORDER,
                    color: '#6B7280',
                    '&:hover': { borderColor: '#9CA3AF', bgcolor: '#F9FAFB' },
                  }}
                >
                  Try Again
                </Button>
              </Box>
            </>
          )}
        </StepRow>

      </Box>
    </Box>
  );
}

