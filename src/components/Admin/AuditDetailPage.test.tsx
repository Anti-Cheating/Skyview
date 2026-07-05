import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'aud-1' }),
  useNavigate: () => mockNavigate,
}));

vi.mock('../../contexts/SnackbarContext', () => ({
  useSnackbar: () => ({ showError: vi.fn(), showSuccess: vi.fn(), showSnackbar: vi.fn(), showWarning: vi.fn(), showInfo: vi.fn() }),
}));

vi.mock('../../services/admin.service', () => ({
  AdminService: { auditDetail: vi.fn() },
}));

import { AdminService } from '../../services/admin.service';
import AuditDetailPage from './AuditDetailPage';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(AdminService.auditDetail).mockResolvedValue({
    data: {
      id: 'aud-1', action: 'license.issue', created_at: '2026-04-01T10:00:00Z',
      actor_name: 'Root', actor_email: 'root@trueyy.com', actor_role: 'System Admin',
      company_name: 'Acme Inc', company_id: 'c1', entity_type: 'license', entity_id: 'lic-1',
      ip_address: '1.2.3.4', user_agent: 'jest', details: { interviews: 500 }, old_value: null, new_value: null,
    },
  } as any);
});

describe('AuditDetailPage', () => {
  test('fetches by id and renders the audit entry detail', async () => {
    render(<AuditDetailPage />);
    expect(await screen.findByText('Audit entry')).toBeInTheDocument();
    expect(AdminService.auditDetail).toHaveBeenCalledWith('aud-1');
    expect(screen.getByText('root@trueyy.com')).toBeInTheDocument();
    expect(screen.getByText('Acme Inc')).toBeInTheDocument();
  });

  test('shows a not-found message when the entry is missing', async () => {
    vi.mocked(AdminService.auditDetail).mockRejectedValue(new Error('nope'));
    render(<AuditDetailPage />);
    expect(await screen.findByText('Audit entry not found.')).toBeInTheDocument();
  });
});
