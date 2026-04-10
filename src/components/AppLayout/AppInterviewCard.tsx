import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Divider,
  Tooltip,
  IconButton,
} from '@mui/material';
import {
  VideoCall as VideoCallIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  Work as WorkIcon,
  Info as InfoIcon,
  AccessTime as AccessTimeIcon,
} from '@mui/icons-material';
import type { InterviewSession } from '../../types/interview.types';
import { USER_ROLES } from '../../config/constants';
import { useState, useEffect } from 'react';

interface AppInterviewCardProps {
  interview: InterviewSession;
  userRole: string;
  onJoin?: (interview: InterviewSession) => void;
}

export default function AppInterviewCard({ interview, userRole, onJoin }: AppInterviewCardProps) {
  const [canJoin, setCanJoin] = useState(false);
  const [joinMessage, setJoinMessage] = useState('');

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }),
      time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    };
  };

  const { date, time } = formatDateTime(interview.scheduled_start_at);

  useEffect(() => {
    const checkJoinAvailability = () => {
      const startTime = new Date(interview.scheduled_start_at).getTime();
      const now = Date.now();
      const diff = startTime - now;

      if (interview.status === 'completed') {
        setCanJoin(true);
        setJoinMessage('View interview details');
        return;
      }
      if (diff <= 0) {
        setCanJoin(true);
        setJoinMessage('Join Interview');
        return;
      }
      if (diff <= 5 * 60 * 1000) {
        setCanJoin(true);
        const mins = Math.ceil(diff / 60000);
        setJoinMessage(`Join Interview (${mins} min${mins !== 1 ? 's' : ''} until start)`);
        return;
      }
      setCanJoin(false);
      const mins = Math.ceil(diff / 60000);
      const hours = Math.floor(mins / 60);
      const rem = mins % 60;
      setJoinMessage(hours > 0 ? `Join available ${hours}h ${rem > 0 ? rem + 'm' : ''} before start` : `Join available ${mins} min before start`);
    };

    checkJoinAvailability();
    const interval = setInterval(checkJoinAvailability, 60000);
    return () => clearInterval(interval);
  }, [interview.scheduled_start_at, interview.status]);

  const getParticipantInfo = () => {
    if (!interview.interview_session_participants?.length) return { name: 'N/A', role: 'N/A' };

    if (userRole === USER_ROLES.CANDIDATE) {
      const p = interview.interview_session_participants.find(p => p.interviewer_id && p.interviewer);
      if (p?.interviewer) {
        return { name: `${p.interviewer.first_name} ${p.interviewer.last_name}`.trim(), role: 'Interviewer' };
      }
      return { name: 'Interviewer', role: 'Interviewer' };
    } else {
      const p = interview.interview_session_participants.find(p => p.candidate_id && p.candidate);
      if (p?.candidate) {
        return { name: `${p.candidate.first_name} ${p.candidate.last_name}`.trim(), role: 'Candidate' };
      }
      return { name: 'Candidate', role: 'Candidate' };
    }
  };

  const participantInfo = getParticipantInfo();
  const title = interview.title || 'Interview';
  const description = interview.description || '';

  const handleJoin = () => {
    if (onJoin) {
      onJoin(interview);
    } else if (interview.provider_metadata?.join_url) {
      window.open(interview.provider_metadata.join_url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <Card
      elevation={0}
      sx={{
        height: '100%',
        borderRadius: '12px',
        border: '1px solid',
        borderColor: '#E0E0E0',
        transition: 'all 0.25s ease',
        bgcolor: '#FFFFFF',
        position: 'relative',
        overflow: 'hidden',
        cursor: 'pointer',
        '&:hover': {
          borderColor: 'primary.main',
          boxShadow: '0 8px 16px rgba(76, 217, 100, 0.25)',
          transform: 'translateY(-2px)',
        },
      }}
    >
      <CardContent sx={{ p: 2.5, display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 1.5,
                bgcolor: 'primary.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {userRole === USER_ROLES.CANDIDATE
                ? <BusinessIcon sx={{ fontSize: 20, color: 'white' }} />
                : <WorkIcon sx={{ fontSize: 20, color: 'white' }} />
              }
            </Box>
            <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
              <Tooltip title={title} arrow placement="top" enterDelay={300}>
                <Typography
                  variant="subtitle1"
                  fontWeight={700}
                  sx={{
                    fontSize: '0.938rem',
                    color: '#212121',
                    lineHeight: 1.4,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    flex: 1,
                  }}
                >
                  {title}
                </Typography>
              </Tooltip>
              {description && (
                <Tooltip title={description} arrow placement="top" enterDelay={200}>
                  <IconButton
                    size="small"
                    sx={{ padding: '4px', color: 'primary.main', '&:hover': { bgcolor: 'rgba(76, 217, 100, 0.08)' } }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <InfoIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          </Box>
        </Box>

        <Divider sx={{ mb: 2, borderColor: '#E0E0E0' }} />

        {/* Details */}
        <Box sx={{ mb: 2, flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <PersonIcon sx={{ fontSize: 18, color: 'primary.main' }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="caption" sx={{ fontSize: '0.688rem', color: '#757575', display: 'block', mb: 0.25 }}>
                {participantInfo.role}
              </Typography>
              <Tooltip title={participantInfo.name} arrow placement="top" enterDelay={300}>
                <Typography variant="body2" sx={{ fontSize: '0.813rem', color: '#212121', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {participantInfo.name}
                </Typography>
              </Tooltip>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
            <ScheduleIcon sx={{ fontSize: 18, color: 'primary.main', mt: 0.25 }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="caption" sx={{ fontSize: '0.688rem', color: '#757575', display: 'block', mb: 0.25 }}>
                Schedule
              </Typography>
              <Typography variant="body2" sx={{ fontSize: '0.813rem', color: '#212121', fontWeight: 500, lineHeight: 1.4, mb: 0.25 }}>
                {date}
              </Typography>
              <Typography variant="body2" sx={{ fontSize: '0.75rem', color: '#757575' }}>
                {time}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Status */}
        <Box sx={{ display: 'flex', gap: 0.5, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <Chip
            label={interview.status || 'Scheduled'}
            size="small"
            sx={{
              fontSize: '0.688rem',
              height: 20,
              bgcolor: interview.status === 'completed' ? '#E8F5E9' : '#F5F5F5',
              color: interview.status === 'completed' ? '#2E7D32' : '#757575',
              fontWeight: 500,
              border: '1px solid',
              borderColor: interview.status === 'completed' ? '#C8E6C9' : '#E0E0E0',
              borderRadius: 1,
              '& .MuiChip-label': { px: 0.75, py: 0 },
            }}
          />
        </Box>

        {/* Action Button */}
        <Tooltip title={!canJoin ? joinMessage : ''} arrow placement="top">
          <span>
            <Button
              variant="contained"
              fullWidth
              startIcon={canJoin ? <VideoCallIcon sx={{ fontSize: 14 }} /> : <AccessTimeIcon sx={{ fontSize: 14 }} />}
              onClick={handleJoin}
              size="small"
              sx={{
                fontSize: '0.75rem',
                py: 0.625,
                textTransform: 'none',
                fontWeight: 600,
                mt: 'auto',
                borderRadius: 1.5,
                bgcolor: canJoin ? 'primary.main' : '#E0E0E0',
                color: canJoin ? '#FFFFFF' : '#9E9E9E',
                boxShadow: 'none',
                '&:hover': canJoin
                  ? { bgcolor: 'primary.dark', boxShadow: '0 4px 12px rgba(76, 217, 100, 0.4)' }
                  : { bgcolor: '#E0E0E0' },
              }}
            >
              {interview.status === 'completed' ? 'View Details' : canJoin ? 'Join Interview' : 'Join Not Available'}
            </Button>
          </span>
        </Tooltip>
      </CardContent>
    </Card>
  );
}
