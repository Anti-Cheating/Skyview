import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const updateUser = vi.fn();
let authUser: any = {
  first_name: 'Jane',
  last_name: 'Doe',
  email: 'jane@acme.com',
  avatar_url: null,
};
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: authUser, updateUser }),
}));

const showSuccess = vi.fn();
const showError = vi.fn();
vi.mock('../../contexts/SnackbarContext', () => ({
  useSnackbar: () => ({ showSuccess, showError }),
}));

const updateMe = vi.fn();
vi.mock('../../services/profile.service', () => ({
  ProfileService: { updateMe: (...a: unknown[]) => updateMe(...a) },
}));

const requestPasswordReset = vi.fn();
vi.mock('../../services/auth.service', () => ({
  AuthService: {
    requestPasswordReset: (...a: unknown[]) => requestPasswordReset(...a),
    uploadAvatar: vi.fn(),
    deleteAvatar: vi.fn(),
  },
}));

import PersonalTab from './PersonalTab';

beforeEach(() => {
  vi.clearAllMocks();
  authUser = {
    first_name: 'Jane',
    last_name: 'Doe',
    email: 'jane@acme.com',
    avatar_url: null,
  };
});

describe('PersonalTab', () => {
  test('prefills the name fields and read-only email', () => {
    render(<PersonalTab />);
    expect(screen.getByLabelText(/first name/i)).toHaveValue('Jane');
    expect(screen.getByLabelText(/last name/i)).toHaveValue('Doe');
    expect(screen.getByLabelText(/email/i)).toHaveValue('jane@acme.com');
  });

  test('Save is disabled until a field changes', async () => {
    render(<PersonalTab />);
    const save = screen.getByRole('button', { name: /save changes/i });
    expect(save).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/first name/i), 'y');
    expect(save).toBeEnabled();
  });

  test('saving calls the service and merges the result into the user', async () => {
    updateMe.mockResolvedValue({
      success: true,
      data: { first_name: 'Janet', last_name: 'Doe' },
    });
    render(<PersonalTab />);

    const first = screen.getByLabelText(/first name/i);
    await userEvent.clear(first);
    await userEvent.type(first, 'Janet');
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() =>
      expect(updateMe).toHaveBeenCalledWith({ first_name: 'Janet', last_name: 'Doe' }),
    );
    expect(updateUser).toHaveBeenCalledWith({ first_name: 'Janet', last_name: 'Doe' });
    expect(showSuccess).toHaveBeenCalledWith('Profile updated');
  });

  test('change password sends a reset email and shows the inbox block', async () => {
    requestPasswordReset.mockResolvedValue('ok');
    render(<PersonalTab />);

    await userEvent.click(screen.getByRole('button', { name: /change password/i }));

    expect(requestPasswordReset).toHaveBeenCalledWith('jane@acme.com');
    expect(await screen.findByText('Check your inbox')).toBeInTheDocument();
  });

  test('surfaces an error when the save fails', async () => {
    updateMe.mockRejectedValue({ message: 'nope' });
    render(<PersonalTab />);

    const first = screen.getByLabelText(/first name/i);
    await userEvent.clear(first);
    await userEvent.type(first, 'Janet');
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByText('nope')).toBeInTheDocument();
    expect(showError).toHaveBeenCalledWith('nope');
  });
});
