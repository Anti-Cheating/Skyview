import { describe, test, expect, vi } from 'vitest';

// useAuth is just a re-export of the AuthContext hook. Mock the context
// module so we can assert the re-export wires through to it.
vi.mock('../../src/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1' }, isAuthenticated: true }),
}));

import { useAuth } from '../../src/hooks/useAuth';
import { useAuth as ctxUseAuth } from '../../src/contexts/AuthContext';

describe('useAuth re-export', () => {
  test('re-exports the AuthContext hook identity', () => {
    expect(useAuth).toBe(ctxUseAuth);
    expect(useAuth()).toEqual({ user: { id: 'u1' }, isAuthenticated: true });
  });
});
