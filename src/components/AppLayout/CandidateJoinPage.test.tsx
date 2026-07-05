import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks ────────────────────────────────────────────────────────────
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'round-1' }),
  useNavigate: () => mockNavigate,
}));

const getById = vi.fn();
vi.mock('../../services/interview.service', () => ({
  InterviewService: { getById: (...a: unknown[]) => getById(...a) },
}));

const consentText = vi.fn();
const consentGrant = vi.fn();
const consentDecline = vi.fn();
const consentRevoke = vi.fn();
vi.mock('../../services/consent.service', () => ({
  ConsentService: {
    text: (...a: unknown[]) => consentText(...a),
    grant: (...a: unknown[]) => consentGrant(...a),
    decline: (...a: unknown[]) => consentDecline(...a),
    revoke: (...a: unknown[]) => consentRevoke(...a),
  },
}));

// useHelper is swapped per test via this mutable object.
let helperState: Record<string, unknown>;
vi.mock('../../hooks/useHelper', () => ({ useHelper: () => helperState }));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'cand-1', role: 'Candidate' } }),
}));

vi.mock('../../services/helperBridge', () => ({
  notifyMeetingJoined: vi.fn(),
  requestHelperPermission: vi.fn().mockResolvedValue(true),
  openSettingsPane: vi.fn(),
  detectHelperPlatform: () => 'mac',
  getHelperDownloadUrl: () => 'https://downloads.trueyy.com/helper.dmg',
}));

import CandidateJoinPage from './CandidateJoinPage';

const interview = {
  id: 'round-1', title: 'Frontend Engineer', status: 'ACTIVE',
  company: { name: 'Demo Corp', logo_url: null },
  provider_metadata: { join_url: 'https://meet.google.com/x' },
  interview_session_participants: [{ id: 'p1', candidate_id: 'cand-1' }],
};

function setHelper(over: Record<string, unknown> = {}) {
  helperState = {
    installed: false, checking: false, status: null,
    join: vi.fn().mockResolvedValue({ ok: true }),
    leave: vi.fn(), refresh: vi.fn(), health: null,
    ...over,
  };
}

function consentResponse(consented: boolean) {
  return { success: true, data: { version: '1.0', body: 'terms', consented, consent_id: consented ? 'c1' : null } };
}

beforeEach(() => {
  vi.clearAllMocks();
  setHelper();
  getById.mockResolvedValue({ success: true, data: interview });
  // The auto-bind effect reads the access token from localStorage.
  localStorage.setItem('access_token', 'test-token');
});

describe('CandidateJoinPage — consent gate + stepper', () => {
  test('shows the consent step first, blocking the setup flow', async () => {
    consentText.mockResolvedValue(consentResponse(false));
    setHelper({ installed: true, status: { screen_recording_ok: true, microphone_ok: true, keyboard_ok: true } });
    render(<CandidateJoinPage />);

    // Consent card renders; the stepper's Consent step is present.
    expect(await screen.findByText('Review & agree to monitoring')).toBeInTheDocument();
    expect(screen.getByText('Consent')).toBeInTheDocument();
    // Even though the helper is installed + permissions granted, the setup
    // steps must NOT render until consent is given.
    expect(screen.queryByText('Grant permissions')).not.toBeInTheDocument();
    expect(screen.queryByText(/open meeting/i)).not.toBeInTheDocument();
  });

  test('agreeing records consent and advances past the consent card', async () => {
    consentText.mockResolvedValue(consentResponse(false));
    consentGrant.mockResolvedValue({ success: true });
    // Helper not installed → after consent, lands on the Install step.
    setHelper({ installed: false });
    render(<CandidateJoinPage />);

    await userEvent.click(await screen.findByRole('button', { name: /agree & continue/i }));

    expect(consentGrant).toHaveBeenCalledWith('round-1', '1.0');
    await waitFor(() => expect(screen.queryByText('Review & agree to monitoring')).not.toBeInTheDocument());
    expect(await screen.findByText('Install Trueyy Helper')).toBeInTheDocument();
  });

  test('declining shows the declined recovery card', async () => {
    consentText.mockResolvedValue(consentResponse(false));
    consentDecline.mockResolvedValue({ success: true });
    render(<CandidateJoinPage />);

    await userEvent.click(await screen.findByRole('button', { name: /decline/i }));

    expect(consentDecline).toHaveBeenCalledWith('round-1');
    expect(await screen.findByText('Monitoring declined')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /i changed my mind/i })).toBeInTheDocument();
  });

  test('with consent already given + helper missing → Install step', async () => {
    consentText.mockResolvedValue(consentResponse(true));
    setHelper({ installed: false });
    render(<CandidateJoinPage />);
    expect(await screen.findByText('Install Trueyy Helper')).toBeInTheDocument();
  });

  test('consent given + helper installed + permissions missing → Permissions step', async () => {
    consentText.mockResolvedValue(consentResponse(true));
    setHelper({ installed: true, status: { screen_recording_ok: false, microphone_ok: false, keyboard_ok: false } });
    render(<CandidateJoinPage />);
    expect(await screen.findByText('Grant permissions')).toBeInTheDocument();
    expect(screen.getByText('Screen Recording')).toBeInTheDocument();
    expect(screen.getByText('Microphone')).toBeInTheDocument();
  });

  test('everything ready → Join step, with the withdraw link', async () => {
    consentText.mockResolvedValue(consentResponse(true));
    setHelper({ installed: true, status: { screen_recording_ok: true, microphone_ok: true, keyboard_ok: true } });
    render(<CandidateJoinPage />);
    expect(await screen.findByRole('button', { name: /open meeting/i })).toBeInTheDocument();
    // Withdraw stays available while monitoring is active.
    expect(screen.getByRole('button', { name: /withdraw monitoring consent/i })).toBeInTheDocument();
  });

  test('withdrawing on the Join step opens the confirm dialog then revokes', async () => {
    consentText.mockResolvedValue(consentResponse(true));
    consentRevoke.mockResolvedValue({ success: true });
    setHelper({ installed: true, status: { screen_recording_ok: true, microphone_ok: true, keyboard_ok: true } });
    render(<CandidateJoinPage />);

    await userEvent.click(await screen.findByRole('button', { name: /withdraw monitoring consent/i }));
    // Confirm dialog.
    expect(await screen.findByText('Withdraw monitoring consent?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^withdraw consent$/i }));

    expect(consentRevoke).toHaveBeenCalledWith('round-1');
    expect(await screen.findByText('Monitoring stopped')).toBeInTheDocument();
  });
});
