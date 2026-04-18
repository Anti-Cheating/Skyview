import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Card, Typography, Button, CircularProgress } from '@mui/material';
import axios from 'axios';
import { ENV } from '../../config/env';
import { InterviewService } from '../../services/interview.service';
import type { InterviewSession } from '../../types/interview.types';

export default function PastInterviewsView() {
  const navigate = useNavigate();
  const [interviews, setInterviews] = useState<InterviewSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [analysisLoading, setAnalysisLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchPastInterviews();
  }, []);

  const fetchPastInterviews = async () => {
    try {
      setLoading(true);
      const res = await InterviewService.getPastInterviews();
      if (res.success) {
        setInterviews(res.data || []);
      }
    } catch (e) {
      console.error('Failed to fetch past interviews:', e);
    } finally {
      setLoading(false);
    }
  };

  const getRiskScore = (): number => {
    // Will be fetched from analysis when ready
    return 0;
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

  const startAnalysis = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setAnalysisLoading(prev => ({ ...prev, [id]: true }));
    try {
      await axios.post(`${ENV.CORTEX_API_URL}/interviews/${id}/analyze`);
      await fetchPastInterviews();
    } catch (err) {
      console.error('Failed to start analysis:', err);
    } finally {
      setAnalysisLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleViewAnalysis = (interview: InterviewSession, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/interview/${interview.id}/analysis`);
  };

  const getAnalysisButton = (interview: InterviewSession) => {
    const status = interview.analysis_status;
    const isLoading = analysisLoading[interview.id];

    if (status === 'ready') {
      return (
        <Button
          variant="contained"
          size="small"
          onClick={(e) => handleViewAnalysis(interview, e)}
          sx={{
            bgcolor: '#4CD964',
            color: '#FFFFFF',
            fontWeight: 600,
            fontSize: '12px',
            textTransform: 'none',
            '&:hover': { bgcolor: '#34C759' },
          }}
        >
          View Analysis
        </Button>
      );
    } else if (status === 'pending') {
      return (
        <Button
          disabled
          size="small"
          sx={{
            fontWeight: 600,
            fontSize: '12px',
            textTransform: 'none',
          }}
          startIcon={<CircularProgress size={14} />}
        >
          Analyzing...
        </Button>
      );
    } else {
      return (
        <Button
          variant="outlined"
          size="small"
          onClick={(e) => startAnalysis(interview.id, e)}
          disabled={isLoading}
          sx={{
            borderColor: '#4CD964',
            color: '#4CD964',
            fontWeight: 600,
            fontSize: '12px',
            textTransform: 'none',
            '&:hover': { bgcolor: 'rgba(76, 217, 100, 0.1)' },
          }}
          startIcon={isLoading ? <CircularProgress size={14} /> : undefined}
        >
          {isLoading ? 'Starting...' : 'Analyze'}
        </Button>
      );
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!interviews.length) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 3, color: '#1F2937', fontSize: '1.5rem' }}>
          Past Interviews
        </Typography>
        <Typography sx={{ color: '#6B7280' }}>No past interviews yet.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3, color: '#1F2937', fontSize: '1.5rem' }}>
        Past Interviews
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {interviews.map((interview) => {
          const riskScore = getRiskScore();
          const riskColor = getRiskColor('CLEAN');

          return (
            <Card
              key={interview.id}
              sx={{
                p: 3,
                display: 'flex',
                gap: 3,
                alignItems: 'center',
                border: '1px solid #E5E7EB',
                borderRadius: 2,
                transition: 'all 0.2s ease',
                '&:hover': {
                  borderColor: '#4CD964',
                  boxShadow: '0 8px 16px rgba(76, 217, 100, 0.15)',
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
                  PENDING
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

              {/* Action Section */}
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                <Typography sx={{ fontSize: '12px', color: '#9CA3AF' }}>
                  {formatDate(interview.scheduled_start_at)}
                </Typography>
                {getAnalysisButton(interview)}
              </Box>
            </Card>
          );
        })}
      </Box>
    </Box>
  );
}
