// Candidate consent endpoints (GDPR Art. 7). Candidate-authenticated —
// ApiService attaches the Bearer token + 401 refresh-retry.
import { ApiService } from './api.service';

export interface ConsentText {
  version: string;
  body: string;
  consented: boolean;
  consent_id: string | null;
}

export const ConsentService = {
  text: (sessionId: string) =>
    ApiService.get<ConsentText>(`/interview-sessions/${sessionId}/consent-text`),
  grant: (sessionId: string, version: string) =>
    ApiService.post(`/interview-sessions/${sessionId}/consent`, { version }),
  decline: (sessionId: string) =>
    ApiService.post(`/interview-sessions/${sessionId}/consent/decline`),
  revoke: (sessionId: string) =>
    ApiService.post(`/interview-sessions/${sessionId}/consent/revoke`),
};
