import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

let search = 'token=verify-token';
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useSearchParams: () => [new URLSearchParams(search)],
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/verify-email' }),
  Link: ({ to, children, ...rest }: any) => (
    <a href={typeof to === 'string' ? to : '#'} {...rest}>{children}</a>
  ),
}));

const verifyEmail = vi.fn();
vi.mock('../../services/auth.service', () => ({
  AuthService: { verifyEmail: (...a: unknown[]) => verifyEmail(...a) },
}));

const refreshAuth = vi.fn();
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ refreshAuth }),
}));

import VerifyEmail from './VerifyEmail';

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  search = 'token=verify-token';
  refreshAuth.mockResolvedValue(undefined);
});

describe('VerifyEmail', () => {
  test('missing token renders the error state immediately', () => {
    search = '';
    render(<VerifyEmail />);
    expect(screen.getByText('Link no longer valid')).toBeInTheDocument();
    expect(screen.getByText(/missing or malformed/i)).toBeInTheDocument();
  });

  test('verifies the token then shows the success state', async () => {
    verifyEmail.mockResolvedValue({});
    render(<VerifyEmail />);

    // Initial spinner state.
    expect(screen.getByText(/verifying your email/i)).toBeInTheDocument();

    expect(await screen.findByText('Email verified')).toBeInTheDocument();
    expect(verifyEmail).toHaveBeenCalledWith('verify-token');
    expect(refreshAuth).toHaveBeenCalled();
  });

  test('invalid token flips to the error state', async () => {
    verifyEmail.mockRejectedValue({ message: 'link used already' });
    render(<VerifyEmail />);

    expect(await screen.findByText('Link no longer valid')).toBeInTheDocument();
    expect(screen.getByText('link used already')).toBeInTheDocument();
  });
});
