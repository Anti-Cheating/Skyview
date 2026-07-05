import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/login' }),
  Link: ({ to, children, ...rest }: any) => (
    <a href={typeof to === 'string' ? to : '#'} {...rest}>{children}</a>
  ),
}));

const login = vi.fn();
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ login, googleLogin: vi.fn() }),
}));

// GoogleAuthButton auto-hides without a client id, but the hook is still
// called before the early return — stub it so it doesn't need a provider.
vi.mock('@react-oauth/google', () => ({ useGoogleLogin: () => vi.fn() }));

import Login from './Login';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Login', () => {
  test('renders the sign-in form', () => {
    render(<Login />);
    expect(screen.getByText('Welcome back.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument();
  });

  test('submit stays disabled until email + password are filled', async () => {
    render(<Login />);
    const submit = screen.getByRole('button', { name: /^sign in$/i });
    expect(submit).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/email/i), 'jane@acme.com');
    await userEvent.type(screen.getByLabelText(/^password/i), 'secret');
    expect(submit).toBeEnabled();
  });

  test('invalid email shows an inline field error and blocks submit', async () => {
    render(<Login />);
    await userEvent.type(screen.getByLabelText(/email/i), 'nope');
    expect(await screen.findByText(/valid email address/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeDisabled();
  });

  test('valid credentials call login()', async () => {
    login.mockResolvedValue(undefined);
    render(<Login />);

    await userEvent.type(screen.getByLabelText(/email/i), 'jane@acme.com');
    await userEvent.type(screen.getByLabelText(/^password/i), 'secret123');
    await userEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    await waitFor(() =>
      expect(login).toHaveBeenCalledWith({ email: 'jane@acme.com', password: 'secret123' }),
    );
  });

  test('401 shows the invalid-credentials error', async () => {
    login.mockRejectedValue({ status: 401 });
    render(<Login />);

    await userEvent.type(screen.getByLabelText(/email/i), 'jane@acme.com');
    await userEvent.type(screen.getByLabelText(/^password/i), 'wrongpass');
    await userEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument();
  });

  test('unverified email (403) routes to check-inbox', async () => {
    login.mockRejectedValue({ status: 403, data: { code: 'EMAIL_NOT_VERIFIED' } });
    render(<Login />);

    await userEvent.type(screen.getByLabelText(/email/i), 'Jane@Acme.com');
    await userEvent.type(screen.getByLabelText(/^password/i), 'secret123');
    await userEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/check-inbox?email=jane%40acme.com'),
    );
  });
});
