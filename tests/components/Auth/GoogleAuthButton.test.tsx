import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks ────────────────────────────────────────────────────────────
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));

const googleLogin = vi.fn();
vi.mock('../../../src/contexts/AuthContext', () => ({
  useAuth: () => ({ googleLogin }),
}));

// Capture the config handed to useGoogleLogin so tests can drive its
// onSuccess/onError callbacks manually. The hook itself returns a spy
// that stands in for "open the Google popup".
let capturedConfig: any;
const triggerLogin = vi.fn();
vi.mock('@react-oauth/google', () => ({
  useGoogleLogin: (config: any) => {
    capturedConfig = config;
    return triggerLogin;
  },
}));

// GOOGLE_CLIENT_ID is read at module-eval time, so we reset the module
// registry and re-stub the env before each import.
async function load(clientId: string) {
  vi.resetModules();
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', clientId);
  return (await import('../../../src/components/Auth/GoogleAuthButton')).GoogleAuthButton;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  capturedConfig = undefined;
});

describe('GoogleAuthButton', () => {
  test('renders nothing when no client id is configured', async () => {
    const GoogleAuthButton = await load('');
    const { container } = render(<GoogleAuthButton mode="signin" />);
    expect(container).toBeEmptyDOMElement();
  });

  test('renders the button with the client id set', async () => {
    const GoogleAuthButton = await load('test-client-id');
    render(<GoogleAuthButton mode="signup" />);
    expect(screen.getByRole('button', { name: /sign up with google/i })).toBeInTheDocument();
  });

  test('clicking opens the Google popup', async () => {
    const GoogleAuthButton = await load('test-client-id');
    render(<GoogleAuthButton mode="signin" />);
    await userEvent.click(screen.getByRole('button', { name: /sign in with google/i }));
    expect(triggerLogin).toHaveBeenCalled();
  });

  test('successful popup forwards the token and navigates on onboarding', async () => {
    googleLogin.mockResolvedValue({ requiresOnboarding: true });
    const GoogleAuthButton = await load('test-client-id');
    render(<GoogleAuthButton mode="signup" />);

    await capturedConfig.onSuccess({ access_token: 'abc' });

    expect(googleLogin).toHaveBeenCalledWith('abc');
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/onboarding/workspace', { replace: true }),
    );
  });

  test('a popup error reports through onError', async () => {
    const onError = vi.fn();
    const GoogleAuthButton = await load('test-client-id');
    render(<GoogleAuthButton mode="signin" onError={onError} />);

    capturedConfig.onError();

    expect(onError).toHaveBeenCalled();
    expect(await screen.findByText(/cancelled or failed/i)).toBeInTheDocument();
  });
});
