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
  topic?: string;
  duration?: number;
  join_url?: string;
  password?: string;
  timezone?: string;
  start_url?: string;
  created_at?: string;
  meeting_id?: number | string | null;
  start_time?: string;
  // Extension-type interviews use this marker
  source?: "extension" | string;
}

/**
 * "application" → candidate uses Falcon desktop app (default)
 * "extension"   → candidate uses Jarvis Chrome extension; interviewer supplies meeting_link
 */
export type InterviewType = "application" | "extension";

export interface ExtensionStatus {
  extension_installed: boolean;
  screen_recording: boolean;
  mic_granted: boolean;
  joined: boolean;
  updated_at: string;
}

export interface InterviewerExtensionStatus {
  extension_installed: boolean;
  mic_granted: boolean;
  updated_at: string;
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
  interview_type?: InterviewType;
  provider: string;
  provider_metadata?: ProviderMetadata;
  // Pre-join setup state populated by Jarvis extension via socket events.
  // Null until the candidate's extension first connects for this session.
  extension_status?: ExtensionStatus | null;
  interviewer_extension_status?: InterviewerExtensionStatus | null;
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
