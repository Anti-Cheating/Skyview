import { useNavigate } from 'react-router-dom';
import { Box, Card, Typography, Chip } from '@mui/material';
import { MOCK_PAST_INTERVIEWS, MOCK_INTERVIEW_SCENARIO_MAP } from '../../mockData/interviewsMock';
import type { InterviewSession } from '../../types/interview.types';

export default function PastInterviewsView() {
  const navigate = useNavigate();

  const getRiskScore = (interviewId: string): number => {
    const scenario = MOCK_INTERVIEW_SCENARIO_MAP[interviewId as keyof typeof MOCK_INTERVIEW_SCENARIO_MAP];
    if (!scenario) return 0;
    if (scenario === 'critical') return 89;
    if (scenario === 'moderate') return 70;
    if (scenario === 'research') return 55;
    if (scenario === 'clean') return 11;
    return 0;
  };

  const getRiskLevel = (interviewId: string): string => {
    const score = getRiskScore(interviewId);
    if (score >= 67) return 'CRITICAL';
    if (score >= 50) return 'MEDIUM';
    if (score >= 30) return 'LOW';
    return 'CLEAN';
  };

  const getRiskColor = (level: string): string => {
    switch (level) {
      case 'CRITICAL': return '#DC2626';
      case 'MEDIUM': return '#F97316';
      case 'LOW': return '#FACC15';
      case 'CLEAN': return '#4CD964';
      default: return '#9CA3AF';
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
  };

  const getParticipantName = (interview: InterviewSession): string => {
    const participant = interview.interview_session_participants?.[0];
    if (participant?.interviewer) {
      return `${participant.interviewer.first_name} ${participant.interviewer.last_name}`;
    }
    return 'Unknown';
  };

  const getParticipantEmail = (interview: InterviewSession): string => {
    const participant = interview.interview_session_participants?.[0];
    if (participant?.interviewer) {
      return participant.interviewer.email;
    }
    return '';
  };

  const handleCardClick = (interview: InterviewSession) => {
    const scenario = MOCK_INTERVIEW_SCENARIO_MAP[interview.id as keyof typeof MOCK_INTERVIEW_SCENARIO_MAP];
    const url = `/interview/${interview.id}/analysis${scenario ? `?mock=${scenario}` : ''}`;
    navigate(url);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3, color: '#1F2937', fontSize: '1.5rem' }}>
        Past Interviews
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {MOCK_PAST_INTERVIEWS.map((interview) => {
          const riskScore = getRiskScore(interview.id);
          const riskLevel = getRiskLevel(interview.id);
          const riskColor = getRiskColor(riskLevel);

          return (
            <Card
              key={interview.id}
              onClick={() => handleCardClick(interview)}
              sx={{
                p: 3,
                display: 'flex',
                gap: 3,
                alignItems: 'center',
                cursor: 'pointer',
                border: '1px solid #E5E7EB',
                borderRadius: 2,
                transition: 'all 0.2s ease',
                '&:hover': {
                  borderColor: '#4CD964',
                  boxShadow: '0 8px 16px rgba(76, 217, 100, 0.15)',
                  transform: 'translateY(-2px)',
                },
              }}
            >
              {/* Risk Score Circle */}
              <Box
                sx={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  bgcolor: `${riskColor}15`,
                  border: `2px solid ${riskColor}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Typography sx={{ fontSize: '24px', fontWeight: 800, color: riskColor }}>
                  {riskScore}
                </Typography>
                <Typography sx={{ fontSize: '10px', fontWeight: 700, color: riskColor, letterSpacing: '0.5px' }}>
                  {riskLevel}
                </Typography>
              </Box>

              {/* Content */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5, color: '#1F2937', fontSize: '15px' }}>
                  {interview.title}
                </Typography>
                <Typography sx={{ fontSize: '13px', color: '#6B7280', mb: 1 }}>
                  {getParticipantName(interview)}
                </Typography>
                <Typography sx={{ fontSize: '12px', color: '#9CA3AF' }}>
                  {getParticipantEmail(interview)}
                </Typography>
              </Box>

              {/* Date & Status */}
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1, flexShrink: 0 }}>
                <Chip
                  label="Completed"
                  size="small"
                  sx={{
                    bgcolor: '#E8F5E9',
                    color: '#2E7D32',
                    fontWeight: 600,
                    fontSize: '11px',
                  }}
                />
                <Typography sx={{ fontSize: '12px', color: '#9CA3AF' }}>
                  {formatDate(interview.scheduled_start_at)}
                </Typography>
              </Box>
            </Card>
          );
        })}
      </Box>
    </Box>
  );
}
