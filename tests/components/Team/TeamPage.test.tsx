import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

let authUser: { company_id: string; role: string } | null;
vi.mock('../../../src/contexts/AuthContext', () => ({
  useAuth: () => ({ user: authUser }),
}));
vi.mock('../../../src/contexts/SnackbarContext', () => ({
  useSnackbar: () => ({ showError: vi.fn(), showSuccess: vi.fn() }),
}));

const list = vi.fn();
const listMembers = vi.fn();
const create = vi.fn();
vi.mock('../../../src/services/invites.service', () => ({
  InvitesService: {
    list: (...a: unknown[]) => list(...a),
    listMembers: (...a: unknown[]) => listMembers(...a),
    create: (...a: unknown[]) => create(...a),
  },
}));

import TeamPage from '../../../src/components/Team/TeamPage';

const member = {
  id: 'm1', email: 'bob@co.com', first_name: 'Bob', last_name: 'Jones',
  avatar_url: null, role: 'Admin', joined_at: '2026-07-01T00:00:00Z',
};
const invite = {
  id: 'inv1', email: 'new@co.com', role: 'Member' as const,
  expires_at: '2026-08-01T00:00:00Z', created_at: '2026-07-01T00:00:00Z',
  inviter: { id: 'u1', first_name: 'Al', last_name: 'Ice', email: 'al@co.com' },
};

beforeEach(() => {
  authUser = { company_id: 'c1', role: 'Owner' };
  listMembers.mockResolvedValue({ success: true, data: { items: [member], total: 1, page: 1, pageSize: 10 } });
  list.mockResolvedValue({ success: true, data: { items: [invite], total: 1, page: 1, pageSize: 10 } });
  create.mockResolvedValue({ success: true, data: { id: 'inv2', email: 'x@co.com', role: 'Member', expires_at: '', invite_url: '', email_sent: true } });
});

describe('TeamPage', () => {
  test('managers see the members table populated after fetch', async () => {
    render(<TeamPage />);
    expect(await screen.findByText('Bob Jones')).toBeInTheDocument();
    expect(screen.getByText('bob@co.com')).toBeInTheDocument();
  });

  test('non-managers are blocked', () => {
    authUser = { company_id: 'c1', role: 'Member' };
    render(<TeamPage />);
    expect(screen.getByText(/Only Owners and Admins can manage the team/)).toBeInTheDocument();
  });

  test('invite dialog: open → fill email → submit calls the service', async () => {
    render(<TeamPage />);
    await screen.findByText('Bob Jones');

    await userEvent.click(screen.getByRole('button', { name: /invite teammate/i }));
    await userEvent.type(screen.getByLabelText(/Email/), 'x@co.com');
    await userEvent.click(screen.getByRole('button', { name: /send invite/i }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith('c1', { email: 'x@co.com', role: 'Member' }),
    );
  });
});
