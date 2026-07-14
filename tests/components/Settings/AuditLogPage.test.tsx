import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('../../../src/contexts/SnackbarContext', () => ({
  useSnackbar: () => ({ showError: vi.fn(), showSuccess: vi.fn() }),
}));

const listAudit = vi.fn();
vi.mock('../../../src/services/audit.service', () => ({
  CompanyAuditService: { list: (...a: unknown[]) => listAudit(...a) },
}));

import AuditLogPage from '../../../src/components/Settings/AuditLogPage';

beforeEach(() => {
  listAudit.mockResolvedValue({
    data: {
      items: [{
        id: 'a1', action: 'auth.login', actor_id: 'u1', actor_name: 'Alice', actor_role: 'Owner',
        entity_type: 'user', entity_id: 'u1', details: { ok: true }, company_id: 'c1',
        created_at: '2026-07-01T10:00:00Z',
      }],
      total: 1,
    },
  });
});

describe('AuditLogPage', () => {
  test('renders the title and a fetched audit row', async () => {
    render(<AuditLogPage />);
    expect(await screen.findByText('Audit log')).toBeInTheDocument();
    expect(await screen.findByText('auth.login')).toBeInTheDocument();
  });
});
