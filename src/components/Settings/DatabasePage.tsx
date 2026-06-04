import { useEffect, useState } from 'react';
import { Box, Stack, Alert } from '@mui/material';
import { SectionHeading, CardTitle, Secondary, Body, Caption } from '../layout/Typography';
import { ActionButton } from '../common/ActionButton';
import { FormField } from '../common/FormField';
import { DataTable, type DataTableColumn } from '../common/DataTable';
import { TOKENS } from '../../theme';
import { V2MigrationService, type MigrationStatus } from '../../services/v2Migration.service';

interface LogLine { ts: string; level: string; msg: string }

// Soft-tinted status pill — colour matrix from docs/design-patterns.md.
function StatusPill({ status }: { status: string }) {
  const c =
    status === 'active' || status === 'succeeded' || status === 'paid'
      ? { bg: 'rgba(34,197,94,0.12)', fg: '#15803D' }
      : status === 'suspended' || status === 'failed' || status === 'dead_lettered' || status === 'overdue'
      ? { bg: 'rgba(239,68,68,0.12)', fg: '#B91C1C' }
      : status === 'running' || status === 'pending' || status === 'paused'
      ? { bg: 'rgba(234,179,8,0.12)', fg: '#A16207' }
      : { bg: '#F3F4F6', fg: '#4B5563' };
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex', alignItems: 'center', px: 1, height: 22,
        borderRadius: '6px', bgcolor: c.bg, color: c.fg,
        fontSize: '0.75rem', fontWeight: 600, lineHeight: 1, textTransform: 'capitalize',
      }}
    >
      {status}
    </Box>
  );
}

function fmtDateTime(ts: string | null | undefined): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleString();
}

export default function DatabasePage() {
  const [dbUrl, setDbUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [migrationId, setMigrationId] = useState<string | null>(null);
  const [status, setStatus] = useState<MigrationStatus | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Poll for migration status. Replace with Socket.io subscription when
  // the migration-log room is wired.
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      const r = await V2MigrationService.status();
      if (cancelled) return;
      setStatus(r.data?.migration ?? null);
      setHistoryLoading(false);
      if (r.data?.migration?.status === 'running' || r.data?.migration?.status === 'pending') {
        setTimeout(poll, 1500);
      }
    }
    poll();
    return () => { cancelled = true; };
  }, [migrationId]);

  const isMigrating = status?.status === 'running' || status?.status === 'pending';

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await V2MigrationService.testConnection(dbUrl);
      setTestResult({
        ok: !!r.data?.ok,
        msg: r.data?.ok ? (r.data?.version ?? 'Connected') : (r.data?.error ?? 'Failed'),
      });
    } catch (e: any) {
      setTestResult({ ok: false, msg: e?.message ?? 'Failed' });
    } finally {
      setTesting(false);
    }
  };

  const handleMigrate = async () => {
    try {
      const r = await V2MigrationService.migrate(dbUrl);
      setMigrationId(r.data?.migration_id ?? null);
    } catch (e: any) {
      setTestResult({ ok: false, msg: `Migration failed to start: ${e?.message ?? 'unknown'}` });
    }
  };

  // Service currently returns only the latest migration; render a
  // one-row table so empty/loading states still use DataTable instead of
  // floating messages.
  const historyRows: MigrationStatus[] = status ? [status] : [];

  const historyColumns: DataTableColumn<MigrationStatus>[] = [
    {
      key: 'started',
      header: 'Started',
      render: (m) => <Body>{fmtDateTime(m.started_at ?? m.created_at)}</Body>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (m) => <StatusPill status={m.status} />,
    },
    {
      key: 'kind',
      header: 'Kind',
      render: (m) => <Body>{m.kind}</Body>,
    },
    {
      key: 'error',
      header: 'Error',
      render: (m) => <Secondary>{m.error_message ?? '—'}</Secondary>,
    },
  ];

  const logLines: LogLine[] = (status?.log_jsonl ?? '')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try { return JSON.parse(line) as LogLine; } catch { return { ts: '', level: 'error', msg: line }; }
    });

  return (
    <Box>
      {/* Header (no inner PageTitle — SettingsLayout renders the page title) */}
      <Box sx={{ mb: 3 }}>
        <SectionHeading>Database</SectionHeading>
        <Secondary>Move your workspace's data to your own Postgres for full data sovereignty.</Secondary>
      </Box>

      {/* Connection section */}
      <Box sx={{ mb: 4 }}>
        <CardTitle sx={{ mb: 2 }}>Connection</CardTitle>
        <FormField
          label="Postgres URL"
          placeholder="postgresql://…"
          value={dbUrl}
          onChange={(e) => setDbUrl(e.target.value)}
          fullWidth
          disabled={isMigrating}
          hint="Required permissions on your Postgres role: CREATE, ALTER, INSERT, UPDATE, DELETE, SELECT on schema public. TLS required."
        />

        <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
          <ActionButton
            variant="secondary"
            onClick={handleTest}
            loading={testing}
            disabled={!dbUrl || isMigrating}
          >
            Test connection
          </ActionButton>
          {isMigrating ? (
            <ActionButton loading>Migrating…</ActionButton>
          ) : (
            <ActionButton
              onClick={handleMigrate}
              disabled={!testResult?.ok || !dbUrl}
            >
              Migrate
            </ActionButton>
          )}
        </Stack>

        {testResult && (
          <Alert severity={testResult.ok ? 'success' : 'error'} sx={{ mt: 2 }}>
            {testResult.msg}
          </Alert>
        )}
      </Box>

      {/* Migration history section */}
      <Box sx={{ mb: 4 }}>
        <CardTitle sx={{ mb: 2 }}>Migration history</CardTitle>
        <DataTable
          columns={historyColumns}
          rows={historyRows}
          rowKey={(m) => m.id}
          loading={historyLoading}
          emptyState={<Secondary>No migrations yet.</Secondary>}
        />
      </Box>

      {/* Live log section — only shown once a migration exists */}
      {status && (
        <Box sx={{ mb: 4 }}>
          <CardTitle sx={{ mb: 2 }}>Live log</CardTitle>
          <Box
            sx={{
              fontFamily: 'monospace',
              fontSize: 12,
              maxHeight: 400,
              overflowY: 'auto',
              bgcolor: '#0B1A10',
              color: '#A7F3D0',
              p: 2,
              borderRadius: '8px',
              border: `1px solid ${TOKENS.border}`,
              whiteSpace: 'pre-wrap',
            }}
          >
            {logLines.length === 0 ? (
              <Caption sx={{ color: TOKENS.textMuted, fontFamily: 'monospace' }}>
                (no log yet)
              </Caption>
            ) : (
              logLines.map((l, i) => (
                <div key={i}>
                  [{(l.ts ?? '').slice(11, 19)}]{' '}
                  {l.level === 'error' ? '✗' : l.level === 'success' ? '✓' : '•'} {l.msg}
                </div>
              ))
            )}
          </Box>
          {status.error_message && (
            <Alert severity="error" sx={{ mt: 2 }}>{status.error_message}</Alert>
          )}
        </Box>
      )}
    </Box>
  );
}
