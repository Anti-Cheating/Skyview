import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/onboarding/workspace' }),
}));

const completeOnboarding = vi.fn();
let authUser: any = { email: 'jane@acme.com' };
vi.mock('../../../src/contexts/AuthContext', () => ({
  useAuth: () => ({ user: authUser, completeOnboarding }),
}));

import OnboardingWorkspace from '../../../src/components/Auth/OnboardingWorkspace';

beforeEach(() => {
  vi.clearAllMocks();
  authUser = { email: 'jane@acme.com' };
});

describe('OnboardingWorkspace', () => {
  test('greets the user by the email local-part', () => {
    render(<OnboardingWorkspace />);
    expect(screen.getByText(/Welcome, jane\./)).toBeInTheDocument();
  });

  test('submit is disabled until a workspace name is entered', async () => {
    render(<OnboardingWorkspace />);
    const submit = screen.getByRole('button', { name: /continue/i });
    expect(submit).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/workspace name/i), 'Acme');
    expect(submit).toBeEnabled();
  });

  test('successful submit creates the workspace and navigates home', async () => {
    completeOnboarding.mockResolvedValue({});
    render(<OnboardingWorkspace />);

    await userEvent.type(screen.getByLabelText(/workspace name/i), '  Acme Corp  ');
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));

    expect(completeOnboarding).toHaveBeenCalledWith('Acme Corp');
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true }));
  });

  test('shows an error when workspace creation fails', async () => {
    completeOnboarding.mockRejectedValue({ data: { error: 'name taken' } });
    render(<OnboardingWorkspace />);

    await userEvent.type(screen.getByLabelText(/workspace name/i), 'Acme');
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));

    expect(await screen.findByText('name taken')).toBeInTheDocument();
  });
});
