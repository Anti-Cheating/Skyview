import type { InterviewSession } from '../types/interview.types';

export const MOCK_PAST_INTERVIEWS: InterviewSession[] = [
  {
    id: 'mock-critical-89',
    title: 'Frontend Engineer Round 1',
    description: 'Technical interview for frontend engineer position',
    created_by: 'interviewer-1',
    scheduled_start_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    scheduled_end_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 3600000).toISOString(),
    actual_start_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    actual_end_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 3600000).toISOString(),
    status: 'completed',
    provider: 'zoom',
    provider_metadata: {
      topic: 'Frontend Engineer Round 1',
      duration: 60,
      join_url: 'https://zoom.us/j/123456789',
      source: 'extension',
    },
    interview_session_participants: [
      {
        id: 'participant-1',
        interviewer_id: 'interviewer-1',
        interviewer: {
          id: 'interviewer-1',
          email: 'john@example.com',
          first_name: 'John',
          last_name: 'Smith',
        },
      },
    ],
    duration_minutes: 60,
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'mock-moderate-70',
    title: 'Backend Engineer Round 1',
    description: 'Technical interview for backend engineer position',
    created_by: 'interviewer-2',
    scheduled_start_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    scheduled_end_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 + 3600000).toISOString(),
    actual_start_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    actual_end_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 + 3600000).toISOString(),
    status: 'completed',
    provider: 'zoom',
    provider_metadata: {
      topic: 'Backend Engineer Round 1',
      duration: 60,
      join_url: 'https://zoom.us/j/987654321',
      source: 'extension',
    },
    interview_session_participants: [
      {
        id: 'participant-2',
        interviewer_id: 'interviewer-2',
        interviewer: {
          id: 'interviewer-2',
          email: 'jane@example.com',
          first_name: 'Jane',
          last_name: 'Doe',
        },
      },
    ],
    duration_minutes: 60,
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// Map mock interview IDs to analysis scenarios
export const MOCK_INTERVIEW_SCENARIO_MAP: Record<string, 'critical' | 'moderate' | 'clean' | 'research'> = {
  'mock-critical-89': 'critical',
  'mock-moderate-70': 'moderate',
};
