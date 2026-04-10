/**
 * App Interview Card — Skyview
 * Mirrors Falcon's InterviewCard design exactly. Skyview does not support
 * joining interviews, so the action button always shows "Join Not Available"
 * (or "View Details" for completed interviews).
 */

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

interface AppInterviewCardProps {
  interview: InterviewSession;
  userRole: string;
  onJoin?: (interview: InterviewSession) => void;
}

export default function AppInterviewCard({ interview, userRole, onJoin }: AppInterviewCardProps) {
  // Format date and time
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      time: date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
  };

  const { date, time } = formatDateTime(interview.scheduled_start_at);

  // Skyview: joining is not supported. Only completed interviews are actionable
  // (View Details). Everything else shows "Join Not Available".
  const isCompleted = interview.status === 'completed';
  const canAction = isCompleted;
  const actionLabel = isCompleted ? 'View Details' : 'Join Not Available';
  const tooltipMessage = isCompleted ? '' : 'Joining interviews is not available in Skyview';

  // Get participant information based on role
  const getParticipantInfo = () => {
    if (!interview.interview_session_participants || interview.interview_session_participants.length === 0) {
      return { name: 'N/A', role: 'N/A' };
    }

    if (userRole === USER_ROLES.CANDIDATE) {
      const participant = interview.interview_session_participants.find(
        (p) => p.interviewer_id && p.interviewer
      );
      if (participant?.interviewer) {
        const { first_name, last_name } = participant.interviewer;
        return {
          name: `${first_name} ${last_name}`.trim(),
          role: 'Interviewer',
        };
      }
      return { name: 'Interviewer', role: 'Interviewer' };
    } else {
      const participant = interview.interview_session_participants.find(
        (p) => p.candidate_id && p.candidate
      );
      if (participant?.candidate) {
        const { first_name, last_name } = participant.candidate;
        return {
          name: `${first_name} ${last_name}`.trim(),
          role: 'Candidate',
        };
      }
      return { name: 'Candidate', role: 'Candidate' };
    }
  };

  const participantInfo = getParticipantInfo();
  const title = interview.title || 'Interview';
  const description = interview.description || '';

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
        {/* Header Section */}
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
              {userRole === USER_ROLES.CANDIDATE ? (
                <BusinessIcon sx={{ fontSize: 20, color: 'white' }} />
              ) : (
                <WorkIcon sx={{ fontSize: 20, color: 'white' }} />
              )}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
              <Tooltip
                title={title}
                arrow
                placement="top"
                enterDelay={300}
                leaveDelay={0}
                PopperProps={{
                  sx: {
                    '& .MuiTooltip-tooltip': {
                      bgcolor: '#212121',
                      color: '#FFFFFF',
                      fontSize: '0.813rem',
                      padding: '8px 12px',
                      maxWidth: 300,
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                    },
                    '& .MuiTooltip-arrow': {
                      color: '#212121',
                    },
                  },
                }}
              >
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
                    textOverflow: 'ellipsis',
                    wordBreak: 'break-word',
                    flex: 1,
                  }}
                >
                  {title}
                </Typography>
              </Tooltip>
              {description && (
                <Tooltip
                  title={description}
                  arrow
                  placement="top"
                  enterDelay={200}
                  leaveDelay={0}
                  PopperProps={{
                    sx: {
                      '& .MuiTooltip-tooltip': {
                        bgcolor: '#212121',
                        color: '#FFFFFF',
                        fontSize: '0.813rem',
                        padding: '10px 14px',
                        maxWidth: 350,
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                        lineHeight: 1.5,
                      },
                      '& .MuiTooltip-arrow': {
                        color: '#212121',
                      },
                    },
                  }}
                >
                  <IconButton
                    size="small"
                    sx={{
                      padding: '4px',
                      color: 'primary.main',
                      '&:hover': {
                        bgcolor: 'rgba(76, 217, 100, 0.08)',
                      },
                    }}
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

        {/* Details Section */}
        <Box sx={{ mb: 2, flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <PersonIcon sx={{ fontSize: 18, color: 'primary.main' }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="caption"
                sx={{
                  fontSize: '0.688rem',
                  color: '#757575',
                  display: 'block',
                  mb: 0.25,
                }}
              >
                {participantInfo.role}
              </Typography>
              <Tooltip
                title={participantInfo.name}
                arrow
                placement="top"
                enterDelay={300}
                leaveDelay={0}
                PopperProps={{
                  sx: {
                    '& .MuiTooltip-tooltip': {
                      bgcolor: '#212121',
                      color: '#FFFFFF',
                      fontSize: '0.813rem',
                      padding: '8px 12px',
                      maxWidth: 200,
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                    },
                    '& .MuiTooltip-arrow': {
                      color: '#212121',
                    },
                  },
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    fontSize: '0.813rem',
                    color: '#212121',
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {participantInfo.name}
                </Typography>
              </Tooltip>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
            <ScheduleIcon sx={{ fontSize: 18, color: 'primary.main', mt: 0.25 }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="caption"
                sx={{
                  fontSize: '0.688rem',
                  color: '#757575',
                  display: 'block',
                  mb: 0.25,
                }}
              >
                Schedule
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontSize: '0.813rem',
                  color: '#212121',
                  fontWeight: 500,
                  lineHeight: 1.4,
                  mb: 0.25,
                }}
              >
                {date}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontSize: '0.75rem',
                  color: '#757575',
                }}
              >
                {time}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Status + Provider Chips */}
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
              '& .MuiChip-label': {
                px: 0.75,
                py: 0,
              },
            }}
          />
          {interview.provider && (
            <Chip
              icon={<VideoCallIcon sx={{ fontSize: 12 }} />}
              label={
                interview.provider === 'daily'
                  ? 'Daily.co'
                  : interview.provider === 'zoom'
                  ? 'Zoom'
                  : interview.provider
              }
              size="small"
              sx={{
                fontSize: '0.688rem',
                height: 20,
                bgcolor: interview.provider === 'daily' ? '#E8F5E9' : '#EDE7F6',
                color: interview.provider === 'daily' ? '#2E7D32' : '#5E35B1',
                fontWeight: 500,
                border: '1px solid',
                borderColor: interview.provider === 'daily' ? '#C8E6C9' : '#D1C4E9',
                borderRadius: 1,
                '& .MuiChip-icon': { color: 'inherit', ml: 0.5 },
                '& .MuiChip-label': { px: 0.75, py: 0 },
              }}
            />
          )}
        </Box>

        {/* Action Button — Skyview: join is not supported */}
        <Tooltip
          title={tooltipMessage}
          arrow
          placement="top"
          PopperProps={{
            sx: {
              '& .MuiTooltip-tooltip': {
                bgcolor: '#212121',
                color: '#FFFFFF',
                fontSize: '0.813rem',
                padding: '8px 12px',
                maxWidth: 250,
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              },
              '& .MuiTooltip-arrow': {
                color: '#212121',
              },
            },
          }}
        >
          <span>
            <Button
              variant="contained"
              fullWidth
              startIcon={
                canAction ? (
                  <VideoCallIcon sx={{ fontSize: 14 }} />
                ) : (
                  <AccessTimeIcon sx={{ fontSize: 14 }} />
                )
              }
              onClick={() => {
                if (canAction && onJoin) {
                  onJoin(interview);
                }
              }}
              size="small"
              sx={{
                fontSize: '0.75rem',
                py: 0.625,
                textTransform: 'none',
                fontWeight: 600,
                mt: 'auto',
                borderRadius: 1.5,
                bgcolor: canAction ? 'primary.main' : '#E0E0E0',
                color: canAction ? '#FFFFFF' : '#9E9E9E',
                boxShadow: 'none',
                '&:hover': canAction
                  ? {
                      bgcolor: 'primary.dark',
                      boxShadow: '0 4px 12px rgba(76, 217, 100, 0.4)',
                    }
                  : {
                      bgcolor: '#E0E0E0',
                    },
                '&.Mui-disabled': {
                  bgcolor: '#E0E0E0',
                  color: '#9E9E9E',
                },
              }}
            >
              {actionLabel}
            </Button>
          </span>
        </Tooltip>
      </CardContent>
    </Card>
  );
}
