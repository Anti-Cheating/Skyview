import { useEffect, useRef, useState } from 'react';
import { Box, Typography, useTheme, IconButton, Chip } from '@mui/material';
import {
  Mic as MicIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
} from '@mui/icons-material';
import type { TranscriptFragment } from '../../hooks/useRiskSocket';

interface LiveTranscriptFeedProps {
  fragments: TranscriptFragment[];
}

export default function LiveTranscriptFeed({ fragments }: LiveTranscriptFeedProps) {
  const theme = useTheme();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  // Auto-scroll to bottom on new fragments
  useEffect(() => {
    if (scrollRef.current && isExpanded) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [fragments, isExpanded]);

  // Count final transcripts
  const finalCount = fragments.filter(f => f.is_final).length;
  const hasInterim = fragments.length > 0 && !fragments[fragments.length - 1].is_final;

  return (
    <Box
      sx={{
        mx: 1.5,
        my: 1,
        borderRadius: '10px',
        border: `1px solid ${theme.palette.divider}`,
        overflow: 'hidden',
        bgcolor: theme.palette.background.default,
      }}
    >
      {/* Header */}
      <Box
        onClick={() => setIsExpanded(!isExpanded)}
        sx={{
          px: 1.5,
          py: 0.8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          bgcolor: fragments.length > 0 ? 'rgba(99, 102, 241, 0.04)' : 'transparent',
          borderBottom: isExpanded && fragments.length > 0 ? `1px solid ${theme.palette.divider}` : 'none',
          '&:hover': { bgcolor: 'rgba(99, 102, 241, 0.08)' },
          transition: 'background-color 0.2s',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
          <MicIcon sx={{ fontSize: 14, color: fragments.length > 0 ? '#6366f1' : theme.palette.text.disabled }} />
          <Typography
            variant="caption"
            sx={{
              fontSize: '0.688rem',
              fontWeight: 600,
              color: theme.palette.text.secondary,
              letterSpacing: '0.03em',
            }}
          >
            Live Transcript
          </Typography>
          {fragments.length > 0 && (
            <Chip
              label={finalCount > 0 ? `${finalCount} utterance${finalCount !== 1 ? 's' : ''}` : 'listening...'}
              size="small"
              sx={{
                height: 16,
                fontSize: '0.563rem',
                fontWeight: 500,
                bgcolor: 'rgba(99, 102, 241, 0.08)',
                color: '#6366f1',
                '& .MuiChip-label': { px: 0.8 },
              }}
            />
          )}
          {hasInterim && (
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                bgcolor: '#6366f1',
                animation: 'transcriptPulse 1.5s infinite',
                '@keyframes transcriptPulse': {
                  '0%, 100%': { opacity: 1 },
                  '50%': { opacity: 0.3 },
                },
              }}
            />
          )}
        </Box>
        <IconButton size="small" sx={{ p: 0.3 }}>
          {isExpanded ? <CollapseIcon sx={{ fontSize: 16 }} /> : <ExpandIcon sx={{ fontSize: 16 }} />}
        </IconButton>
      </Box>

      {/* Transcript content */}
      {isExpanded && fragments.length > 0 && (
        <Box
          ref={scrollRef}
          sx={{
            maxHeight: 200,
            overflow: 'auto',
            px: 1.5,
            py: 1,
            '&::-webkit-scrollbar': { width: '3px' },
            '&::-webkit-scrollbar-thumb': {
              background: 'rgba(99, 102, 241, 0.2)',
              borderRadius: '3px',
            },
          }}
        >
          {fragments.map((f, i) => (
            <Typography
              key={i}
              component="span"
              sx={{
                fontSize: '0.8rem',
                lineHeight: 1.7,
                color: theme.palette.text.primary,
                opacity: f.is_final ? 1 : 0.4,
                transition: 'opacity 0.3s',
              }}
            >
              {f.text}{' '}
            </Typography>
          ))}
        </Box>
      )}

      {/* Empty state */}
      {isExpanded && fragments.length === 0 && (
        <Box
          sx={{
            px: 1.5,
            py: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography
            variant="caption"
            sx={{
              fontSize: '0.688rem',
              color: theme.palette.text.disabled,
              fontStyle: 'italic',
            }}
          >
            Waiting for speech...
          </Typography>
        </Box>
      )}
    </Box>
  );
}
