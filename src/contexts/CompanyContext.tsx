/**
 * CompanyContext — caches the current user's company so we don't refetch
 * it on every page mount. Sidebar (logo), CandidateJoinPage (logo +
 * description), and the Profile Company tab all read from here.
 *
 * Lifecycle:
 *   - Fires GET /companies/:id when user.company_id flips to a value.
 *   - Clears on logout (user becomes null).
 *   - Exposes an updateCompany() merge so the Profile tab can push the
 *     newly-saved row back into context without triggering a refetch
 *     (avoids the same blink we fixed for the user object).
 *
 * Candidates have null company_id; for them company stays null and any
 * consumer falls back to the Trueyy mark.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { CompaniesService, type Company } from '../services/companies.service';
import { useAuth } from './AuthContext';

interface CompanyContextType {
  company: Company | null;
  isLoading: boolean;
  refreshCompany: () => Promise<void>;
  updateCompany: (next: Company) => void;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const companyId = user?.company_id ?? null;

  const [company, setCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refreshCompany = useCallback(async () => {
    if (!companyId) {
      setCompany(null);
      return;
    }
    setIsLoading(true);
    try {
      const resp = await CompaniesService.getById(companyId);
      if (resp.success && resp.data) setCompany(resp.data);
    } catch (err) {
      // Non-fatal — sidebar simply falls back to Trueyy mark.
      console.warn('Failed to load company:', err);
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (companyId) refreshCompany();
    else setCompany(null);
  }, [companyId, refreshCompany]);

  const updateCompany = useCallback((next: Company) => {
    setCompany(next);
  }, []);

  return (
    <CompanyContext.Provider
      value={{ company, isLoading, refreshCompany, updateCompany }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany(): CompanyContextType {
  const ctx = useContext(CompanyContext);
  if (ctx === undefined) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return ctx;
}
