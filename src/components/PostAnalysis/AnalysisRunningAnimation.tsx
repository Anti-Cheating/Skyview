import { useState, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  AiBrain01Icon,
  CheckmarkCircle01Icon,
  Loading03Icon,
} from '@hugeicons/core-free-icons';

interface AnalysisRunningAnimationProps {
  /** Optional custom title text */
  title?: string;
}

const STAGES = [
  { id: 'loading', label: 'Loading', detail: 'Loading session data & events…' },
  { id: 'checking', label: 'Checking', detail: 'Checking application & window telemetry…' },
  { id: 'transcribing', label: 'Transcribing', detail: 'Transcribing speech & audio signals…' },
  { id: 'preparing', label: 'Preparing', detail: 'Preparing behavioral anomaly detection…' },
  { id: 'synthesizing', label: 'Synthesizing', detail: 'Synthesizing integrity score & report…' },
];

export default function AnalysisRunningAnimation({
  title = 'Analyzing Interview',
}: AnalysisRunningAnimationProps) {
  const [currentStage, setCurrentStage] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentStage((prev) => (prev < STAGES.length - 1 ? prev + 1 : prev));
    }, 2400);
    return () => clearInterval(timer);
  }, []);

  const activeStage = STAGES[currentStage] ?? STAGES[0];

  return (
    <Box
      data-testid="analysis-running-animation"
      sx={{
        py: { xs: 4, sm: 5 },
        px: 2,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* ── Keyframe animations ── */}
      <Box
        component="style"
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes radarPulseGreen {
              0% { transform: scale(0.85); opacity: 0.8; }
              50% { transform: scale(1.15); opacity: 0.25; }
              100% { transform: scale(1.45); opacity: 0; }
            }
            @keyframes radarSweepGreen {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            @keyframes spinLoaderGreen {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            @keyframes shimmerWaveGreen {
              0% { background-position: -200% 0; }
              100% { background-position: 200% 0; }
            }
            @keyframes dotBlinkGreen {
              0%, 100% { opacity: 1; transform: scale(1); }
              50% { opacity: 0.35; transform: scale(0.8); }
            }
          `,
        }}
      />

      {/* ── Radar Scanner Visualization (Trueyy Green) ── */}
      <Box
        sx={{
          position: 'relative',
          width: 100,
          height: 100,
          mb: 2.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Outer expanding pulse ring 1 */}
        <Box
          sx={{
            position: 'absolute',
            width: 100,
            height: 100,
            borderRadius: '50%',
            border: '2px solid rgba(22, 163, 74, 0.4)',
            animation: 'radarPulseGreen 2.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) infinite',
            pointerEvents: 'none',
          }}
        />

        {/* Outer expanding pulse ring 2 (offset) */}
        <Box
          sx={{
            position: 'absolute',
            width: 100,
            height: 100,
            borderRadius: '50%',
            border: '2px solid rgba(76, 217, 100, 0.25)',
            animation: 'radarPulseGreen 2.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) 1.2s infinite',
            pointerEvents: 'none',
          }}
        />

        {/* Rotating radar sweep arm */}
        <Box
          sx={{
            position: 'absolute',
            width: 82,
            height: 82,
            borderRadius: '50%',
            border: '1px dashed rgba(22, 163, 74, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'radarSweepGreen 3.6s linear infinite',
            pointerEvents: 'none',
            '&::after': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: '50%',
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: '#16A34A',
              boxShadow: '0 0 8px #16A34A',
              transform: 'translate(-50%, -50%)',
            },
          }}
        />

        {/* Center glowing badge in Trueyy Green */}
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #16A34A 0%, #15803D 100%)',
            boxShadow: '0 4px 14px rgba(22, 163, 74, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            zIndex: 1,
          }}
        >
          <HugeiconsIcon icon={AiBrain01Icon} size={28} color="#FFFFFF" />
        </Box>
      </Box>

      {/* ── Status pill badge (Green) ── */}
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.75,
          bgcolor: 'rgba(22, 163, 74, 0.08)',
          border: '1px solid rgba(22, 163, 74, 0.25)',
          borderRadius: '999px',
          px: 1.5,
          py: 0.4,
          mb: 1.5,
        }}
      >
        <Box
          sx={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            bgcolor: '#16A34A',
            boxShadow: '0 0 6px #16A34A',
            animation: 'dotBlinkGreen 1.5s ease-in-out infinite',
          }}
        />
        <Typography
          sx={{
            fontSize: '0.6875rem',
            fontWeight: 700,
            color: '#16A34A',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            lineHeight: 1,
          }}
        >
          AI PIPELINE ACTIVE
        </Typography>
      </Box>

      {/* ── Title ── */}
      <Typography
        sx={{
          fontSize: { xs: '1.125rem', sm: '1.25rem' },
          fontWeight: 700,
          color: '#111827',
          mb: 0.5,
        }}
      >
        {title}
      </Typography>

      {/* ── Active Stage Detail (Dynamic Status) ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5, minHeight: 24 }}>
        <Box sx={{ display: 'inline-flex', animation: 'spinLoaderGreen 1.2s linear infinite' }}>
          <HugeiconsIcon icon={Loading03Icon} size={15} color="#16A34A" />
        </Box>
        <Typography
          sx={{
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: '#374151',
          }}
        >
          {activeStage.detail}
        </Typography>
      </Box>

      {/* ── Green Shimmer Progress Bar ── */}
      <Box
        sx={{
          width: '100%',
          maxWidth: 360,
          height: 4,
          borderRadius: '999px',
          bgcolor: '#E5E7EB',
          overflow: 'hidden',
          mb: 2.5,
        }}
      >
        <Box
          sx={{
            width: '100%',
            height: '100%',
            background: 'linear-gradient(90deg, #16A34A 0%, #4CD964 50%, #16A34A 100%)',
            backgroundSize: '200% 100%',
            animation: 'shimmerWaveGreen 1.8s ease-in-out infinite',
          }}
        />
      </Box>

      {/* ── Stage-wise Compact Progress Pills ── */}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          gap: { xs: 0.75, sm: 1 },
          maxWidth: 520,
        }}
      >
        {STAGES.map((stage, idx) => {
          const isDone = idx < currentStage;
          const isCurrent = idx === currentStage;

          return (
            <Box
              key={stage.id}
              data-testid={isDone ? 'stage-completed' : isCurrent ? 'stage-in-progress' : 'stage-pending'}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.6,
                px: 1.2,
                py: 0.4,
                borderRadius: '6px',
                bgcolor: isCurrent
                  ? 'rgba(22, 163, 74, 0.1)'
                  : isDone
                    ? 'rgba(22, 163, 74, 0.05)'
                    : '#F9FAFB',
                border: `1px solid ${
                  isCurrent
                    ? 'rgba(22, 163, 74, 0.35)'
                    : isDone
                      ? 'rgba(22, 163, 74, 0.2)'
                      : '#E5E7EB'
                }`,
                transition: 'all 0.25s ease',
              }}
            >
              {isDone ? (
                <HugeiconsIcon icon={CheckmarkCircle01Icon} size={14} color="#16A34A" />
              ) : isCurrent ? (
                <Box sx={{ display: 'inline-flex', animation: 'spinLoaderGreen 1.2s linear infinite' }}>
                  <HugeiconsIcon icon={Loading03Icon} size={13} color="#16A34A" />
                </Box>
              ) : (
                <Box
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    bgcolor: '#D1D5DB',
                  }}
                />
              )}
              <Typography
                sx={{
                  fontSize: '0.6875rem',
                  fontWeight: isCurrent ? 700 : isDone ? 600 : 500,
                  color: isCurrent ? '#15803D' : isDone ? '#16A34A' : '#9CA3AF',
                  lineHeight: 1.2,
                }}
              >
                {stage.label}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
