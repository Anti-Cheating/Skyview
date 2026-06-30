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
  Chip,
  Divider,
  Tooltip,
  IconButton,
} from '@mui/material';
import { ActionButton } from '../common/ActionButton';
import {
  VideoCall as VideoCallIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  PersonOutline as PersonOutlineIcon,
  Business as BusinessIcon,
  Work as WorkIcon,
  Info as InfoIcon,
  AccessTime as AccessTimeIcon,
  Edit as EditIcon,
  DeleteOutline as DeleteIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import type { InterviewSession } from '../../types/interview.types';
import { USER_ROLES, isStaffRole, isCompanyManagerRole } from '../../config/constants';
import { useAuth } from '../../contexts/AuthContext';

interface AppInterviewCardProps {
  interview: InterviewSession;
  userRole: string;
  onJoin?: (interview: InterviewSession) => void;
  onEdit?: (interview: InterviewSession) => void;
  onDelete?: (interview: InterviewSession) => void;
}

export default function AppInterviewCard({ interview, userRole, onJoin, onEdit, onDelete }: AppInterviewCardProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const viewerId = user?.id;
  // Role gates for the card's row actions. Edit is allowed for any staff
  // (Owner/Admin/Member); Delete is reserved for Owner/Admin/SysAdmin
  // — mirrors Cortex's `ROLE_GROUPS.Staff` and `CompanyManager` guards.
  // We also hide both once the session is ENDED — there's nothing useful
  // to edit on a finished interview, and deleting completed sessions is
  // destructive audit-trail loss we prefer to avoid from this surface.
  const canEdit = isStaffRole(userRole) && interview.status !== 'COMPLETED' && !!onEdit;
  const canDelete = isCompanyManagerRole(userRole) && !!onDelete;
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

  // Action button behavior depends on role + interview type:
  //   - Interviewer + extension  → "Open Monitoring" (→ /interviews/:id/monitor)
  //   - Interviewer + application → "Open Falcon App" (disabled — interviewer needs desktop app)
  //   - Candidate   + extension  → "Join Interview" (→ message Jarvis extension)
  //   - Completed                → "View Details"
  //   - Otherwise (candidate + application) → "Join in Falcon App"
  const isCompleted = interview.status === 'COMPLETED';
  const isCancelled = interview.status === 'CANCELLED';
  // A cancelled or completed session is closed — nobody can join/monitor it.
  const isClosed = isCompleted || isCancelled;
  const isInterviewer = isStaffRole(userRole);
  const isCandidate = userRole === USER_ROLES.CANDIDATE;
  const canMonitor = isInterviewer && !isClosed;
  const canCandidateJoin = isCandidate && !isClosed;
  const canJoin = canMonitor || canCandidateJoin;

  let actionLabel: string;
  let tooltipMessage: string;
  if (isCancelled) {
    actionLabel = 'Cancelled';
    tooltipMessage = 'This interview was cancelled';
  } else if (isCompleted) {
    actionLabel = 'View Details';
    tooltipMessage = '';
  } else if (canMonitor) {
    actionLabel = 'Open Monitoring';
    tooltipMessage = '';
  } else if (canCandidateJoin) {
    actionLabel = 'Join Interview';
    tooltipMessage = '';
  } else {
    actionLabel = 'View Details';
    tooltipMessage = '';
  }

  const handleAction = () => {
    if (canMonitor) {
      navigate(`/interviews/${interview.id}/monitor`);
      return;
    }
    if (canCandidateJoin) {
      navigate(`/interviews/${interview.id}/join`);
      return;
    }
    if (onJoin) {
      onJoin(interview);
    }
  };

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

  // ── Staff-only enrichments ────────────────────────────────────────
  // These only render on the staff side of the card. Candidates get
  // a leaner view because most of these fields (who scheduled it,
  // who'll take it from the company) aren't useful to them.
  const interviewerParticipant = interview.interview_session_participants?.find(
    (p) => p.interviewer_id && p.interviewer
  );
  const assignedInterviewerName = interviewerParticipant?.interviewer
    ? `${interviewerParticipant.interviewer.first_name} ${interviewerParticipant.interviewer.last_name}`.trim()
    : null;
  const isAssignedInterviewer =
    !!viewerId && interviewerParticipant?.interviewer_id === viewerId;
  const scheduler = interview.created_by_user;
  const schedulerName = scheduler
    ? `${scheduler.first_name} ${scheduler.last_name}`.trim() || scheduler.email
    : null;
  // Suppress the "Scheduled by" line when the scheduler is also the
  // assigned interviewer — it's just noise in the common "I scheduled
  // myself for this" path.
  const showScheduler =
    !!schedulerName &&
    scheduler?.id !== interviewerParticipant?.interviewer_id;
  const durationMinutes = interview.duration_minutes;
  const statusLabel = interview.status || 'Scheduled';
  const isEnded = statusLabel === 'COMPLETED';
  const isActive = statusLabel === 'ACTIVE';
  const statusChipSx = {
    fontSize: '0.625rem',
    height: 18,
    bgcolor: isEnded
      ? '#E8F5E9'
      : isActive
      ? 'rgba(76, 217, 100, 0.12)'
      : '#F5F5F5',
    color: isEnded ? '#2E7D32' : isActive ? '#2E7D32' : '#757575',
    fontWeight: 600,
    border: '1px solid',
    borderColor: isEnded
      ? '#C8E6C9'
      : isActive
      ? 'rgba(76, 217, 100, 0.35)'
      : '#E0E0E0',
    borderRadius: 1,
    letterSpacing: '0.02em',
    '& .MuiChip-label': { px: 0.6, py: 0 },
  } as const;

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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
            <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 0.5 }}>
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
              {/* Status chip moved to the header (was a bottom chips
                  row). `ml: 'auto'` floats it to the right so it sits
                  neatly grouped with the action icons rather than
                  hanging in the middle of the row. */}
              <Chip label={statusLabel} size="small" sx={{ ...statusChipSx, ml: 'auto' }} />
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
              {canEdit && (
                <Tooltip title="Edit interview" arrow placement="top">
                  <IconButton
                    size="small"
                    sx={{
                      padding: '4px',
                      color: '#6B7280',
                      '&:hover': {
                        bgcolor: 'rgba(59, 130, 246, 0.08)',
                        color: '#3B82F6',
                      },
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit?.(interview);
                    }}
                  >
                    <EditIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
              )}
              {canDelete && (
                <Tooltip title="Cancel interview" arrow placement="top">
                  <IconButton
                    size="small"
                    sx={{
                      padding: '4px',
                      color: '#6B7280',
                      '&:hover': {
                        bgcolor: 'rgba(239, 68, 68, 0.08)',
                        color: '#EF4444',
                      },
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete?.(interview);
                    }}
                  >
                    <DeleteIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          </Box>
        </Box>

        <Divider sx={{ mb: 2, borderColor: '#E0E0E0' }} />

        {/* Details Section */}
        <Box sx={{ mb: 2, flex: 1 }}>
          {/* Job role (from the parent interview process) + which round this is.
              Null on legacy flat sessions, so the row only shows when present. */}
          {interview.role && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <WorkIcon sx={{ fontSize: 18, color: 'primary.main' }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="caption"
                  sx={{ fontSize: '0.688rem', color: '#757575', display: 'block', mb: 0.25 }}
                >
                  Role
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ fontSize: '0.813rem', color: '#212121', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {interview.role}
                  {interview.round_order != null ? ` · Round ${interview.round_order}` : ''}
                </Typography>
              </Box>
            </Box>
          )}
          {/* Candidate-only: which company is interviewing them. The
              briefcase header icon hints at it but a name is what
              actually disambiguates "Frontend Round 1" between
              employers when a candidate juggles multiple processes. */}
          {isCandidate && interview.company?.name && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <BusinessIcon sx={{ fontSize: 18, color: 'primary.main' }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="caption"
                  sx={{ fontSize: '0.688rem', color: '#757575', display: 'block', mb: 0.25 }}
                >
                  Company
                </Typography>
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
                  {interview.company.name}
                </Typography>
              </Box>
            </Box>
          )}

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

          {/* Staff-only: who's actually taking this interview. The HR
              person scheduling it now picks an interviewer from a
              dropdown, so this might NOT be the logged-in viewer —
              hence the "You" badge when it is. */}
          {isInterviewer && assignedInterviewerName && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <PersonOutlineIcon sx={{ fontSize: 18, color: 'primary.main' }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="caption"
                  sx={{ fontSize: '0.688rem', color: '#757575', display: 'block', mb: 0.25 }}
                >
                  Interviewer
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
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
                    {assignedInterviewerName}
                  </Typography>
                  {isAssignedInterviewer && (
                    <Chip
                      label="You"
                      size="small"
                      sx={{
                        fontSize: '0.625rem',
                        height: 16,
                        bgcolor: 'rgba(76, 217, 100, 0.12)',
                        color: '#2E7D32',
                        fontWeight: 600,
                        border: '1px solid rgba(76, 217, 100, 0.35)',
                        borderRadius: 1,
                        '& .MuiChip-label': { px: 0.6, py: 0 },
                      }}
                    />
                  )}
                </Box>
              </Box>
            </Box>
          )}

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
                {durationMinutes ? ` · ${durationMinutes} min` : ''}
              </Typography>
              {isInterviewer && showScheduler && (
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: '0.688rem',
                    color: '#9CA3AF',
                    display: 'block',
                    mt: 0.5,
                  }}
                >
                  Scheduled by {schedulerName}
                </Typography>
              )}
            </Box>
          </Box>
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
            <ActionButton
              variant={canJoin ? 'primary' : 'secondary'}
              fullWidth
              startIcon={
                canJoin ? (
                  <VideoCallIcon sx={{ fontSize: 14 }} />
                ) : (
                  <AccessTimeIcon sx={{ fontSize: 14 }} />
                )
              }
              onClick={handleAction}
              disabled={!canJoin}
              sx={{ mt: 'auto' }}
            >
              {actionLabel}
            </ActionButton>
          </span>
        </Tooltip>
      </CardContent>
    </Card>
  );
}
