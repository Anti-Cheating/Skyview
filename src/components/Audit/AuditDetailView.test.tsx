import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

import AuditDetailView from './AuditDetailView';
import type { AuditDetail } from '../../services/audit.service';

const detail: AuditDetail = {
  id: 'a1',
  action: 'session.update',
  actor_id: 'u1',
  actor_name: 'Alice',
  actor_role: 'Owner',
  actor_email: 'alice@demo.co',
  entity_type: 'session',
  entity_id: 'sess-9',
  details: { changed: 'title' },
  old_value: { title: 'Old' },
  new_value: { title: 'New' },
  ip_address: '10.0.0.1',
  user_agent: 'Mozilla/5.0',
  company_id: 'c1',
  company_name: 'Demo Corp',
  created_at: '2026-07-05T10:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AuditDetailView', () => {
  test('renders the envelope fields and action chip', () => {
    render(<AuditDetailView detail={detail} backTo="/audit" />);
    expect(screen.getByText('Audit entry')).toBeInTheDocument();
    expect(screen.getByText('session.update')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('alice@demo.co')).toBeInTheDocument();
    expect(screen.getByText('10.0.0.1')).toBeInTheDocument();
    expect(screen.getByText('Demo Corp')).toBeInTheDocument();
  });

  test('renders old/new value JSON blocks', () => {
    render(<AuditDetailView detail={detail} backTo="/audit" />);
    expect(screen.getByText('Old value')).toBeInTheDocument();
    expect(screen.getByText('New value')).toBeInTheDocument();
    expect(screen.getByText(/"title": "New"/)).toBeInTheDocument();
  });

  test('back button navigates to backTo', async () => {
    render(<AuditDetailView detail={detail} backTo="/audit" />);
    await userEvent.click(screen.getByRole('button', { name: /back to audit log/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/audit');
  });

  test('empty payload shows the "no payload" note', () => {
    const bare: AuditDetail = {
      ...detail, details: null, old_value: null, new_value: null,
    };
    render(<AuditDetailView detail={bare} backTo="/audit" />);
    expect(screen.getByText(/No payload recorded/i)).toBeInTheDocument();
  });
});
