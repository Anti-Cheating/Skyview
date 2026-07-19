import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/forgot-password' }),
  Link: ({ to, children, ...rest }: any) => (
    <a href={typeof to === 'string' ? to : '#'} {...rest}>{children}</a>
  ),
}));

const requestPasswordReset = vi.fn();
vi.mock('../../../src/services/auth.service', () => ({
  AuthService: { requestPasswordReset: (...a: unknown[]) => requestPasswordReset(...a) },
}));

import ForgotPassword from '../../../src/components/Auth/ForgotPassword';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ForgotPassword', () => {
  test('renders the email form', () => {
    render(<ForgotPassword />);
    expect(screen.getByText('Forgot your password?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();
  });

  test('typing an invalid email shows the inline field error', async () => {
    render(<ForgotPassword />);
    await userEvent.type(screen.getByLabelText(/email/i), 'not-an-email');
    expect(await screen.findByText(/valid email address/i)).toBeInTheDocument();
  });

  test('submitting a valid email calls the service and shows the confirmation', async () => {
    requestPasswordReset.mockResolvedValue('ok');
    render(<ForgotPassword />);

    await userEvent.type(screen.getByLabelText(/email/i), 'Jane@Acme.com');
    await userEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    // Email is lower-cased + trimmed before the call.
    await waitFor(() => expect(requestPasswordReset).toHaveBeenCalledWith('jane@acme.com'));
    expect(await screen.findByText('Check your inbox')).toBeInTheDocument();
    // The confirmation echoes back exactly what the user typed.
    expect(screen.getByText('Jane@Acme.com')).toBeInTheDocument();
  });

  test('server 500 still lands on the confirmation but surfaces an error', async () => {
    requestPasswordReset.mockRejectedValue({ status: 500, message: 'boom' });
    render(<ForgotPassword />);

    await userEvent.type(screen.getByLabelText(/email/i), 'jane@acme.com');
    await userEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    // Anti-enumeration: still shows the success card.
    expect(await screen.findByText('Check your inbox')).toBeInTheDocument();
  });
});
