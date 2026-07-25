import { ApiService } from './api.service';

export interface ContactQuery {
  id: string;
  name: string | null;
  email: string;
  company: string | null;
  type: string | null;
  message: string | null;
  created_at: string;
}

/**
 * Company-scoped contact queries for the logged-in user. name/email/company +
 * company_id are attached server-side from the session — the client only
 * supplies the message.
 */
export const ContactService = {
  /** Raise a query (e.g. from the Enterprise "Contact sales" card). */
  async raise(message: string, type?: string): Promise<void> {
    await ApiService.post('/api/companies/me/contact', { message, ...(type ? { type } : {}) });
  },

  /** This company's own past queries, newest first. */
  async list(): Promise<{ items: ContactQuery[]; total: number }> {
    const res = await ApiService.get<{ items: ContactQuery[]; total: number }>('/api/companies/me/contact');
    return { items: res.data?.items ?? [], total: res.data?.total ?? 0 };
  },
};
