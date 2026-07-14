import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

let authed = false;
vi.mock('../../../src/contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: authed }),
}));

import NotFoundPage from '../../../src/components/NotFound/NotFoundPage';

beforeEach(() => {
  vi.clearAllMocks();
  authed = false;
});

describe('NotFoundPage', () => {
  test('renders the 404 empty state', () => {
    render(<NotFoundPage />);
    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByText('Page not found')).toBeInTheDocument();
  });

  test('for signed-out visitors, the CTA goes to login', async () => {
    render(<NotFoundPage />);
    const cta = screen.getByRole('button', { name: /go to login/i });
    await userEvent.click(cta);
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  test('for authenticated users, the CTA goes back to the dashboard', async () => {
    authed = true;
    render(<NotFoundPage />);
    const cta = screen.getByRole('button', { name: /back to dashboard/i });
    await userEvent.click(cta);
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });
});
