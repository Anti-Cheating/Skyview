import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

let authUser: any = null;
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: authUser }),
}));

// Stub the heavy children — this suite only exercises ProfilePage's
// role-based layout gating.
vi.mock('./PersonalTab', () => ({ default: () => <div data-testid="personal-tab" /> }));
vi.mock('./CompanyTab', () => ({
  default: ({ companyId }: { companyId: string }) => (
    <div data-testid="company-tab">{companyId}</div>
  ),
}));
vi.mock('../Settings/BrandingPage', () => ({ default: () => <div data-testid="branding" /> }));

import ProfilePage from './ProfilePage';

beforeEach(() => {
  authUser = null;
});

describe('ProfilePage', () => {
  test('prompts to sign in when there is no user', () => {
    render(<ProfilePage />);
    expect(screen.getByText('Please sign in.')).toBeInTheDocument();
  });

  test('an Owner with a company sees the company + branding cards', () => {
    authUser = { role: 'Owner', company_id: 'co-1' };
    render(<ProfilePage />);
    expect(screen.getByTestId('personal-tab')).toBeInTheDocument();
    expect(screen.getByTestId('company-tab')).toHaveTextContent('co-1');
    expect(screen.getByTestId('branding')).toBeInTheDocument();
  });

  test('a Member sees only the personal card', () => {
    authUser = { role: 'Member', company_id: 'co-1' };
    render(<ProfilePage />);
    expect(screen.getByTestId('personal-tab')).toBeInTheDocument();
    expect(screen.queryByTestId('company-tab')).not.toBeInTheDocument();
    expect(screen.queryByTestId('branding')).not.toBeInTheDocument();
  });
});
