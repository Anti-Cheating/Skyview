import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks ────────────────────────────────────────────────────────────
let search = 'email=jane%40acme.com';
vi.mock('react-router-dom', () => ({
  useSearchParams: () => [new URLSearchParams(search)],
  useLocation: () => ({ pathname: '/check-inbox' }),
  Link: ({ to, children, ...rest }: any) => (
    <a href={typeof to === 'string' ? to : '#'} {...rest}>{children}</a>
  ),
}));

const resendVerification = vi.fn();
vi.mock('../../services/auth.service', () => ({
  AuthService: { resendVerification: (...a: unknown[]) => resendVerification(...a) },
}));

import CheckInbox from './CheckInbox';

beforeEach(() => {
  vi.clearAllMocks();
  search = 'email=jane%40acme.com';
});

describe('CheckInbox', () => {
  test('shows the email the link was sent to', () => {
    render(<CheckInbox />);
    expect(screen.getByText('Verify your email')).toBeInTheDocument();
    expect(screen.getByText('jane@acme.com')).toBeInTheDocument();
  });

  test('resend calls the service and shows a success message', async () => {
    resendVerification.mockResolvedValue('sent');
    render(<CheckInbox />);

    await userEvent.click(screen.getByRole('button', { name: /resend verification email/i }));

    expect(resendVerification).toHaveBeenCalledWith('jane@acme.com');
    expect(await screen.findByText(/verification email sent/i)).toBeInTheDocument();
  });

  test('shows an error when the resend fails', async () => {
    resendVerification.mockRejectedValue({ message: 'rate limited' });
    render(<CheckInbox />);

    await userEvent.click(screen.getByRole('button', { name: /resend verification email/i }));

    expect(await screen.findByText('rate limited')).toBeInTheDocument();
  });

  test('resend button is disabled when no email is present', () => {
    search = '';
    render(<CheckInbox />);
    expect(screen.getByRole('button', { name: /resend verification email/i })).toBeDisabled();
  });
});
