import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useParams: () => ({ token: 'tok-123' }),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/invite/tok-123', search: '', hash: '', state: null, key: 'k' }),
}));

const refreshAuth = vi.fn().mockResolvedValue(undefined);
vi.mock('../../../src/contexts/AuthContext', () => ({
  useAuth: () => ({ refreshAuth }),
}));

const getPublic = vi.fn();
const accept = vi.fn();
vi.mock('../../../src/services/invites.service', () => ({
  InvitesService: {
    getPublic: (...a: unknown[]) => getPublic(...a),
    accept: (...a: unknown[]) => accept(...a),
  },
}));

import InviteAcceptPage from '../../../src/components/Team/InviteAcceptPage';

beforeEach(() => {
  accept.mockResolvedValue({
    ok: true,
    data: { user: { id: 'u9', email: 'new@co.com', role: 'Member' }, accessToken: 'a', refreshToken: 'r' },
  });
});

describe('InviteAcceptPage', () => {
  test('invalid / expired invite shows the recovery card', async () => {
    getPublic.mockResolvedValue(null);
    render(<InviteAcceptPage />);
    expect(await screen.findByText('Invitation unavailable')).toBeInTheDocument();
  });

  test('new user: fills the sign-up form and accepts', async () => {
    getPublic.mockResolvedValue({
      email: 'new@co.com', role: 'Member', company_name: 'Acme',
      invited_by_name: 'Al', expires_at: '2026-08-01T00:00:00Z', email_already_registered: false,
    });
    render(<InviteAcceptPage />);
    expect(await screen.findByText('Welcome aboard.')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/First name/), 'Jane');
    await userEvent.type(screen.getByLabelText(/Last name/), 'Doe');
    await userEvent.type(screen.getByLabelText(/Password/), 'password123');
    await userEvent.click(screen.getByRole('button', { name: /accept invitation/i }));

    await waitFor(() => expect(accept).toHaveBeenCalledWith('tok-123', {
      first_name: 'Jane', last_name: 'Doe', password: 'password123',
    }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true }));
  });

  test('already-registered invitee accepts with an empty body', async () => {
    getPublic.mockResolvedValue({
      email: 'existing@co.com', role: 'Admin', company_name: 'Acme',
      invited_by_name: 'Al', expires_at: '2026-08-01T00:00:00Z', email_already_registered: true,
    });
    render(<InviteAcceptPage />);
    await screen.findByText('Welcome aboard.');
    await userEvent.click(screen.getByRole('button', { name: /accept invitation/i }));
    await waitFor(() => expect(accept).toHaveBeenCalledWith('tok-123', {}));
  });
});
