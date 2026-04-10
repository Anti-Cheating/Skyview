export interface UserInfo {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
}

export interface InterviewParticipant {
  id: string;
  candidate_id?: string | null;
  interviewer_id?: string | null;
  interviewer?: UserInfo | null;
  candidate?: UserInfo | null;
}

export interface ProviderMetadata {
  topic: string;
  duration: number;
  join_url: string;
  password?: string;
  timezone: string;
  start_url?: string;
  created_at?: string;
  meeting_id?: number;
  start_time?: string;
}

export interface InterviewSession {
  id: string;
  title: string;
  description?: string;
  created_by: string;
  scheduled_start_at: string;
  scheduled_end_at: string;
  actual_start_at?: string | null;
  actual_end_at?: string | null;
  provider: string;
  provider_metadata?: ProviderMetadata;
  status: string;
  duration_minutes?: number;
  timezone?: string;
  interview_session_participants: InterviewParticipant[];
  created_at?: string;
  updated_at?: string;
}

export interface InterviewSessionResponse {
  interview_sessions?: InterviewSession[];
}
