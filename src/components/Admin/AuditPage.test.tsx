import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));

vi.mock('../../contexts/SnackbarContext', () => ({
  useSnackbar: () => ({ showError: vi.fn(), showSuccess: vi.fn(), showSnackbar: vi.fn(), showWarning: vi.fn(), showInfo: vi.fn() }),
}));

vi.mock('../../services/admin.service', () => ({
  AdminService: { audit: vi.fn() },
}));

import { AdminService } from '../../services/admin.service';
import AuditPage from './AuditPage';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(AdminService.audit).mockResolvedValue({
    data: {
      items: [
        { id: 'aud-1', action: 'license.issue', company_id: 'c1', company_name: 'Acme Inc', actor_name: 'Root', actor_id: 'u1', entity_type: 'license', entity_id: 'lic-12345678', created_at: '2026-04-01T10:00:00Z', details: { interviews: 500 } },
      ],
      total: 1,
    },
  } as any);
});

describe('AuditPage', () => {
  test('renders the audit heading and a fetched entry row', async () => {
    render(<AuditPage />);
    expect(screen.getByText('Audit log')).toBeInTheDocument();
    expect(await screen.findByText('license.issue')).toBeInTheDocument();
    expect(screen.getByText('Acme Inc')).toBeInTheDocument();
  });

  test('clicking a row navigates to its detail page', async () => {
    render(<AuditPage />);
    await userEvent.click(await screen.findByText('license.issue'));
    expect(mockNavigate).toHaveBeenCalledWith('/admin/audit/aud-1');
  });
});
