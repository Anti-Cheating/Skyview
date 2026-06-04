import { ApiService } from './api.service';

export interface MigrationStatus {
  id: string;
  company_id: string;
  kind: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed';
  log_jsonl: string;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
  created_at: string;
}

export const V2MigrationService = {
  testConnection: (dbUrl: string) =>
    ApiService.post<{ ok: boolean; version?: string; error?: string }>(
      '/api/companies/me/database/test-connection',
      { db_url: dbUrl },
    ),
  migrate: (dbUrl: string) =>
    ApiService.post<{ migration_id: string }>('/api/companies/me/database/migrate', {
      db_url: dbUrl,
    }),
  status: () =>
    ApiService.get<{ migration: MigrationStatus | null }>(
      '/api/companies/me/database/migration-status',
    ),
};
