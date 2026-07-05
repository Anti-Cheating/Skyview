import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

let search = 'token=reset-token';
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useSearchParams: () => [new URLSearchParams(search)],
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/reset-password' }),
  Link: ({ to, children, ...rest }: any) => (
    <a href={typeof to === 'string' ? to : '#'} {...rest}>{children}</a>
  ),
}));

const resetPassword = vi.fn();
vi.mock('../../services/auth.service', () => ({
  AuthService: { resetPassword: (...a: unknown[]) => resetPassword(...a) },
}));

const showSuccess = vi.fn();
vi.mock('../../contexts/SnackbarContext', () => ({
  useSnackbar: () => ({ showSuccess, showError: vi.fn() }),
}));

import ResetPassword from './ResetPassword';

beforeEach(() => {
  vi.clearAllMocks();
  search = 'token=reset-token';
});

describe('ResetPassword', () => {
  test('shows the invalid-link card when the token is missing', () => {
    search = '';
    render(<ResetPassword />);
    expect(screen.getByText('Reset link invalid')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /request new link/i })).toBeInTheDocument();
  });

  test('renders the form when a token is present', () => {
    render(<ResetPassword />);
    expect(screen.getByText('Set a new password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /update password/i })).toBeDisabled();
  });

  test('weak password surfaces the validation message', async () => {
    render(<ResetPassword />);
    await userEvent.type(screen.getByLabelText(/^new password/i), 'short');
    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument();
  });

  test('mismatched confirmation blocks submit', async () => {
    render(<ResetPassword />);
    await userEvent.type(screen.getByLabelText(/^new password/i), 'Abcdef12');
    await userEvent.type(screen.getByLabelText(/confirm new password/i), 'Different1');
    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /update password/i })).toBeDisabled();
  });

  test('valid submit calls the service and redirects to login', async () => {
    resetPassword.mockResolvedValue(undefined);
    render(<ResetPassword />);

    await userEvent.type(screen.getByLabelText(/^new password/i), 'Abcdef12');
    await userEvent.type(screen.getByLabelText(/confirm new password/i), 'Abcdef12');
    await userEvent.click(screen.getByRole('button', { name: /update password/i }));

    expect(resetPassword).toHaveBeenCalledWith('reset-token', 'Abcdef12');
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true }));
    expect(showSuccess).toHaveBeenCalled();
  });

  test('service failure shows the error banner', async () => {
    resetPassword.mockRejectedValue({ data: { error: 'link expired' } });
    render(<ResetPassword />);

    await userEvent.type(screen.getByLabelText(/^new password/i), 'Abcdef12');
    await userEvent.type(screen.getByLabelText(/confirm new password/i), 'Abcdef12');
    await userEvent.click(screen.getByRole('button', { name: /update password/i }));

    expect(await screen.findByText('link expired')).toBeInTheDocument();
  });
});
