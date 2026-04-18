import { useNavigate } from 'react-router-dom';
import { Box, Typography } from '@mui/material';

export default function SidebarPastInterviews() {
  const navigate = useNavigate();

  const handleViewInterviews = () => {
    navigate('/interviews/past');
  };

  return (
    <Box sx={{
      p: 1.5,
      borderTop: '1px solid rgba(255,255,255,0.15)',
      bgcolor: 'transparent',
      color: '#FFFFFF',
      flexShrink: 0,
    }}>
      <Typography
        variant="subtitle2"
        onClick={handleViewInterviews}
        sx={{
          fontWeight: 700,
          fontSize: '12px',
          color: 'rgba(255,255,255,0.6)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          cursor: 'pointer',
          '&:hover': { color: 'rgba(255,255,255,0.9)' },
          transition: 'color 0.2s ease',
        }}
      >
        Past Interviews
      </Typography>
    </Box>
  );
}
