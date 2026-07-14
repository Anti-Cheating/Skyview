import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'a1' }),
  useNavigate: () => vi.fn(),
}));
vi.mock('../../../src/contexts/SnackbarContext', () => ({
  useSnackbar: () => ({ showError: vi.fn(), showSuccess: vi.fn() }),
}));

const detail = vi.fn();
vi.mock('../../../src/services/audit.service', () => ({
  CompanyAuditService: { detail: (...a: unknown[]) => detail(...a) },
}));

import AuditDetailPage from '../../../src/components/Settings/AuditDetailPage';

beforeEach(() => {
  detail.mockResolvedValue({
    data: {
      id: 'a1', action: 'user.update', actor_id: 'u1', actor_name: 'Alice', actor_role: 'Owner',
      actor_email: 'alice@co.com', entity_type: 'user', entity_id: 'u1', details: { field: 'role' },
      old_value: null, new_value: null, ip_address: '1.2.3.4', user_agent: 'UA',
      company_id: 'c1', company_name: 'Acme', created_at: '2026-07-01T10:00:00Z',
    },
  });
});

describe('AuditDetailPage', () => {
  test('loads and renders the audit entry detail', async () => {
    render(<AuditDetailPage />);
    expect(await screen.findByText('Audit entry')).toBeInTheDocument();
    expect(screen.getByText('user.update')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('alice@co.com')).toBeInTheDocument();
  });
});
