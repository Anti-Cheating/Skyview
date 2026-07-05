import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/signup' }),
  Link: ({ to, children, ...rest }: any) => (
    <a href={typeof to === 'string' ? to : '#'} {...rest}>{children}</a>
  ),
}));

const signup = vi.fn();
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ signup, googleLogin: vi.fn() }),
}));

vi.mock('@react-oauth/google', () => ({ useGoogleLogin: () => vi.fn() }));

import Signup from './Signup';

async function fillValidForm() {
  await userEvent.type(screen.getByLabelText(/first name/i), 'Jane');
  await userEvent.type(screen.getByLabelText(/last name/i), 'Doe');
  await userEvent.type(screen.getByLabelText(/company name/i), 'Acme');
  await userEvent.type(screen.getByLabelText(/email/i), 'jane@acme.com');
  await userEvent.type(screen.getByLabelText(/^password/i), 'Abcdef12');
  await userEvent.type(screen.getByLabelText(/confirm password/i), 'Abcdef12');
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Signup', () => {
  test('renders the sign-up form', () => {
    render(<Signup />);
    expect(screen.getByText('Welcome to Trueyy.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^sign up$/i })).toBeInTheDocument();
  });

  test('submit is disabled on an empty form', () => {
    render(<Signup />);
    expect(screen.getByRole('button', { name: /^sign up$/i })).toBeDisabled();
  });

  test('mismatched passwords show a live hint and keep submit disabled', async () => {
    render(<Signup />);
    await userEvent.type(screen.getByLabelText(/^password/i), 'Abcdef12');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'Zzzzzz99');
    expect(await screen.findByText(/passwords don't match/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^sign up$/i })).toBeDisabled();
  });

  test('a weak password shows the strength meter and keeps submit disabled', async () => {
    render(<Signup />);
    await userEvent.type(screen.getByLabelText(/first name/i), 'Jane');
    await userEvent.type(screen.getByLabelText(/last name/i), 'Doe');
    await userEvent.type(screen.getByLabelText(/company name/i), 'Acme');
    await userEvent.type(screen.getByLabelText(/email/i), 'jane@acme.com');
    // 8+ chars but all-lowercase → strength score 1 ("Weak") and still
    // fails isStrongPassword (no upper/digit), so submit stays disabled.
    await userEvent.type(screen.getByLabelText(/^password/i), 'abcdefgh');
    expect(screen.getByText('Weak')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^sign up$/i })).toBeDisabled();
  });

  test('a fully valid form calls signup and routes to check-inbox', async () => {
    signup.mockResolvedValue({ email: 'jane@acme.com' });
    render(<Signup />);
    await fillValidForm();

    const submit = screen.getByRole('button', { name: /^sign up$/i });
    expect(submit).toBeEnabled();
    await userEvent.click(submit);

    expect(signup).toHaveBeenCalledWith({
      firstName: 'Jane',
      lastName: 'Doe',
      companyName: 'Acme',
      email: 'jane@acme.com',
      password: 'Abcdef12',
    });
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/check-inbox?email=jane%40acme.com'),
    );
  });

  test('a 409 conflict surfaces the error banner', async () => {
    signup.mockRejectedValue({ status: 409, message: 'Email already exists' });
    render(<Signup />);
    await fillValidForm();
    await userEvent.click(screen.getByRole('button', { name: /^sign up$/i }));

    expect(await screen.findByText('Email already exists')).toBeInTheDocument();
  });
});
