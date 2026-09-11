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
  /** Optional custom subtitle text */
  subtitle?: string;
}

const STAGES = [
  { id: 'transcribe', label: 'Transcribing and indexing audio streams & speech patterns' },
  { id: 'telemetry', label: 'Scanning window telemetry, applications, and display events' },
  { id: 'keyboard', label: 'Cross-referencing keyboard events, shortcuts, and copy-paste signals' },
  { id: 'verdict', label: 'Synthesizing integrity verdict, timeline annotations & insights' },
];

export default function AnalysisRunningAnimation({
  title = 'Analyzing Interview & Modalities',
  subtitle = 'Cross-referencing multimodal signals to generate a verified session integrity analysis.',
}: AnalysisRunningAnimationProps) {
  const [currentStage, setCurrentStage] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentStage((prev) => (prev < STAGES.length - 1 ? prev + 1 : prev));
    }, 2800);
    return () => clearInterval(timer);
  }, []);

  return (
    <Box
      data-testid="analysis-running-animation"
      sx={{
        py: { xs: 4, sm: 6 },
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
            @keyframes radarPulse {
              0% { transform: scale(0.85); opacity: 0.8; }
              50% { transform: scale(1.15); opacity: 0.3; }
              100% { transform: scale(1.45); opacity: 0; }
            }
            @keyframes radarSweep {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            @keyframes spinLoader {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            @keyframes shimmerWave {
              0% { background-position: -200% 0; }
              100% { background-position: 200% 0; }
            }
            @keyframes dotBlink {
              0%, 100% { opacity: 1; transform: scale(1); }
              50% { opacity: 0.4; transform: scale(0.8); }
            }
          `,
        }}
      />

      {/* ── Radar Scanner Visualization ── */}
      <Box
        sx={{
          position: 'relative',
          width: 110,
          height: 110,
          mb: 3,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Outer expanding pulse ring 1 */}
        <Box
          sx={{
            position: 'absolute',
            width: 110,
            height: 110,
            borderRadius: '50%',
            border: '2px solid rgba(37, 99, 235, 0.4)',
            animation: 'radarPulse 2.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) infinite',
            pointerEvents: 'none',
          }}
        />

        {/* Outer expanding pulse ring 2 (offset) */}
        <Box
          sx={{
            position: 'absolute',
            width: 110,
            height: 110,
            borderRadius: '50%',
            border: '2px solid rgba(37, 99, 235, 0.25)',
            animation: 'radarPulse 2.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) 1.2s infinite',
            pointerEvents: 'none',
          }}
        />

        {/* Rotating radar sweep arm */}
        <Box
          sx={{
            position: 'absolute',
            width: 90,
            height: 90,
            borderRadius: '50%',
            border: '1px dashed rgba(37, 99, 235, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'radarSweep 4s linear infinite',
            pointerEvents: 'none',
            '&::after': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: '50%',
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: '#2563EB',
              boxShadow: '0 0 8px #2563EB',
              transform: 'translate(-50%, -50%)',
            },
          }}
        />

        {/* Center glowing badge */}
        <Box
          sx={{
            width: 58,
            height: 58,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
            boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
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

      {/* ── Status pill badge ── */}
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.75,
          bgcolor: 'rgba(37, 99, 235, 0.08)',
          border: '1px solid rgba(37, 99, 235, 0.2)',
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
            animation: 'dotBlink 1.6s ease-in-out infinite',
          }}
        />
        <Typography
          sx={{
            fontSize: '0.6875rem',
            fontWeight: 700,
            color: '#2563EB',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            lineHeight: 1,
          }}
        >
          AI PIPELINE ACTIVE
        </Typography>
      </Box>

      {/* ── Title & Subtitle ── */}
      <Typography
        sx={{
          fontSize: { xs: '1.125rem', sm: '1.25rem' },
          fontWeight: 700,
          color: '#111827',
          mb: 0.75,
        }}
      >
        {title}
      </Typography>
      <Typography
        sx={{
          fontSize: '0.8125rem',
          color: '#6B7280',
          maxWidth: 480,
          mb: 3.5,
          lineHeight: 1.5,
        }}
      >
        {subtitle}
      </Typography>

      {/* ── Shimmer Progress Bar ── */}
      <Box
        sx={{
          width: '100%',
          maxWidth: 380,
          height: 4,
          borderRadius: '999px',
          bgcolor: '#E5E7EB',
          overflow: 'hidden',
          mb: 3,
        }}
      >
        <Box
          sx={{
            width: '100%',
            height: '100%',
            background: 'linear-gradient(90deg, #2563EB 0%, #38BDF8 50%, #2563EB 100%)',
            backgroundSize: '200% 100%',
            animation: 'shimmerWave 1.8s ease-in-out infinite',
          }}
        />
      </Box>

      {/* ── Dynamic Pipeline Stages ── */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 1.25,
          width: '100%',
          maxWidth: 420,
          textAlign: 'left',
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
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                px: 1.25,
                py: 0.75,
                borderRadius: '8px',
                bgcolor: isCurrent ? 'rgba(37, 99, 235, 0.04)' : 'transparent',
                border: isCurrent ? '1px solid rgba(37, 99, 235, 0.15)' : '1px solid transparent',
                transition: 'all 0.3s ease',
              }}
            >
              <Box
                sx={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  color: isDone ? '#16A34A' : isCurrent ? '#2563EB' : '#D1D5DB',
                }}
              >
                {isDone ? (
                  <HugeiconsIcon icon={CheckmarkCircle01Icon} size={18} color="#16A34A" />
                ) : isCurrent ? (
                  <Box sx={{ display: 'inline-flex', animation: 'spinLoader 1.2s linear infinite' }}>
                    <HugeiconsIcon icon={Loading03Icon} size={18} color="#2563EB" />
                  </Box>
                ) : (
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: '#E5E7EB',
                    }}
                  />
                )}
              </Box>
              <Typography
                sx={{
                  fontSize: '0.75rem',
                  fontWeight: isCurrent ? 600 : 500,
                  color: isDone ? '#4B5563' : isCurrent ? '#111827' : '#9CA3AF',
                  lineHeight: 1.3,
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
