/**
 * FalconDownloadCard — shared download prompt for application-type interviews.
 * Used by both CandidateJoinPage and MonitoringView.
 */

import { Box, Typography, Button } from '@mui/material';
import { GetApp as DownloadIcon } from '@mui/icons-material';
import { TOKENS } from '../../theme';

export default function FalconDownloadCard() {
  return (
    <Box sx={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', pt: { xs: 3, md: 6 }, px: { xs: 2, md: 3 } }}>
      <Box
        sx={{
          width: 460,
          maxWidth: '100%',
          bgcolor: TOKENS.bgCard,
          borderRadius: '12px',
          border: `1px solid ${TOKENS.border}`,
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ display: 'flex', gap: 1.5, px: 2.5, py: 2.5 }}>
          <Box
            sx={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              bgcolor: TOKENS.brand,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.7rem',
              fontWeight: 700,
              flexShrink: 0,
              mt: 0.25,
            }}
          >
            <DownloadIcon sx={{ fontSize: 16 }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: TOKENS.textPrimary, mb: 0.5 }}>
              Download Trueyy App
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: TOKENS.textSecondary, mb: 1.5 }}>
              Download and install the Trueyy desktop app to join your monitored interview.
            </Typography>
            <Button
              variant="contained"
              size="small"
              onClick={() => window.open('https://www.trueyy.com/', '_blank', 'noopener')}
              sx={{
                bgcolor: TOKENS.brand,
                color: '#fff',
                textTransform: 'none',
                fontSize: '0.75rem',
                fontWeight: 600,
                py: 0.5,
                px: 2,
                borderRadius: '6px',
                '&:hover': { bgcolor: TOKENS.brandHover },
                boxShadow: 'none',
              }}
            >
              Download App
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
