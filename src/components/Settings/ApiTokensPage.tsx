/**
 * ApiTokensPage — Settings → API Tokens.
 *
 * Lives under <SettingsLayout>, which already renders the top-of-page
 * <PageTitle>Settings</PageTitle> + the underline tabs. This page is
 * just the active tab's body, so it starts with a section subtitle +
 * actions row and the <DataTable> directly underneath — no inner
 * PageTitle, no outer page padding.
 *
 * Generated plaintext tokens are shown ONCE in a follow-up dialog
 * with a Copy button + clear warning, mirroring how Stripe / Linear /
 * Clerk surface one-shot secrets.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Stack,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  InputAdornment,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import {
  SectionHeading,
  Secondary,
  Body,
  Caption,
} from '../layout/Typography';
import { DataTable, type DataTableColumn } from '../common/DataTable';
import { ActionButton } from '../common/ActionButton';
import { FormField } from '../common/FormField';
import { TOKENS } from '../../theme';
import {
  ApiTokensService,
  type ApiToken,
  type CreatedApiToken,
} from '../../services/apiTokens.service';

const PAGE_SIZE = 20;

// Soft-tinted env pill, matching the design-patterns colour matrix:
//   live → success (green); test → warning (amber).
// 6px radius, 22px height — same dimensions as TeamPage's RolePill so
// the visual rhythm of pills across the app stays in sync.
const ENV_COLORS: Record<ApiToken['environment'], { bg: string; fg: string }> = {
  live: { bg: 'rgba(34,197,94,0.12)', fg: '#15803D' },
  test: { bg: 'rgba(234,179,8,0.12)', fg: '#A16207' },
};

function EnvPill({ env }: { env: ApiToken['environment'] }) {
  const c = ENV_COLORS[env];
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        px: 1,
        height: 22,
        borderRadius: '6px',
        bgcolor: c.bg,
        color: c.fg,
        fontSize: '0.75rem',
        fontWeight: 600,
        lineHeight: 1,
        textTransform: 'capitalize',
      }}
    >
      {env}
    </Box>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDateTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function ApiTokensPage() {
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Generate-token dialog state.
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [env, setEnv] = useState<ApiToken['environment']>('live');
  const [busy, setBusy] = useState(false);

  // One-shot plaintext reveal dialog.
  const [created, setCreated] = useState<CreatedApiToken | null>(null);
  const [copied, setCopied] = useState(false);

  // Pagination — client-side; this list is short. We still render the
  // pagination footer (showSizeChanger: false) for consistency with
  // every other list page in Skyview.
  const [page, setPage] = useState(1);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    ApiTokensService.list()
      .then((data) => {
        if (alive) setTokens(data);
      })
      .catch((e: any) => {
        if (alive) setError(e?.message ?? 'Failed to load tokens');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const openDialog = () => {
    setLabel('');
    setEnv('live');
    setError(null);
    setOpen(true);
  };

  const handleCreate = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await ApiTokensService.create({
        label: label.trim(),
        environment: env,
      });
      setTokens((prev) => [
        {
          id: res.id,
          prefix: res.prefix,
          label: res.label,
          environment: res.environment,
          last_used_at: null,
          created_at: res.created_at,
          expires_at: res.expires_at,
        },
        ...prev,
      ]);
      setOpen(false);
      setCreated(res);
      setCopied(false);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to generate token');
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async (token: ApiToken) => {
    if (
      !window.confirm(
        `Revoke "${token.label}"? Any service using it will lose access immediately.`,
      )
    )
      return;
    try {
      await ApiTokensService.revoke(token.id);
      setTokens((prev) => prev.filter((t) => t.id !== token.id));
    } catch (e: any) {
      setError(e?.message ?? 'Failed to revoke token');
    }
  };

  const handleCopy = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.plaintext);
      setCopied(true);
    } catch {
      // clipboard may be unavailable (insecure context, denied perms);
      // user can still select + copy the text manually.
    }
  };

  // ── Columns ─────────────────────────────────────────────────────────

  const columns = useMemo<DataTableColumn<ApiToken>[]>(
    () => [
      {
        key: 'label',
        header: 'Label',
        render: (t) => (
          <Body sx={{ fontWeight: 600 }}>{t.label}</Body>
        ),
      },
      {
        key: 'prefix',
        header: 'Token',
        width: 280,
        render: (t) => (
          <Caption
            sx={{
              fontFamily:
                'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
              fontSize: '0.8125rem',
              color: TOKENS.textSecondary,
              letterSpacing: '0.02em',
            }}
          >
            {t.prefix}
            <Box component="span" sx={{ color: TOKENS.textSecondary, opacity: 0.6 }}>
              ••••••••••••••••
            </Box>
          </Caption>
        ),
      },
      {
        key: 'environment',
        header: 'Env',
        width: 100,
        render: (t) => <EnvPill env={t.environment} />,
      },
      {
        key: 'created_at',
        header: 'Created',
        width: 140,
        hideOn: 'mobile',
        render: (t) => (
          <Caption sx={{ color: TOKENS.textSecondary, fontSize: '0.8125rem' }}>
            {formatDate(t.created_at)}
          </Caption>
        ),
      },
      {
        key: 'last_used_at',
        header: 'Last used',
        width: 180,
        hideOn: 'mobile',
        render: (t) => (
          <Caption sx={{ color: TOKENS.textSecondary, fontSize: '0.8125rem' }}>
            {formatDateTime(t.last_used_at)}
          </Caption>
        ),
      },
      {
        key: 'actions',
        header: '',
        align: 'right',
        width: 48,
        showOnHover: true,
        render: (t) => (
          <IconButton
            size="small"
            aria-label={`Revoke ${t.label}`}
            onClick={() => handleRevoke(t)}
            sx={{ color: TOKENS.textSecondary }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        ),
      },
    ],
    [],
  );

  // Client-side slice for the pagination footer.
  const pagedRows = useMemo(
    () => tokens.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [tokens, page],
  );

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 2 }}
      >
        <Box>
          <SectionHeading>API Tokens</SectionHeading>
          <Secondary>Tokens authenticate your API clients. We only show the secret once at creation — copy it immediately.</Secondary>
        </Box>
        <ActionButton onClick={openDialog}>Generate token</ActionButton>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <DataTable<ApiToken>
        columns={columns}
        rows={pagedRows}
        rowKey={(t) => t.id}
        loading={loading}
        emptyState={
          <Secondary>No tokens yet. Generate your first one.</Secondary>
        }
        pagination={{
          page,
          pageSize: PAGE_SIZE,
          total: tokens.length,
          showSizeChanger: false,
          onChange: (next) => setPage(next),
        }}
      />

      {/* Generate-token dialog */}
      <Dialog
        open={open}
        onClose={() => (busy ? undefined : setOpen(false))}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Generate API token</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Secondary sx={{ color: TOKENS.textSecondary }}>
              Give the token a descriptive label so you can tell where it's used.
              The plaintext value is shown once — store it somewhere safe.
            </Secondary>
            <FormField
              autoFocus
              required
              label="Label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              disabled={busy}
              placeholder="e.g. Production backend"
            />
            <FormField
              required
              select
              label="Environment"
              value={env}
              onChange={(e) =>
                setEnv(e.target.value as ApiToken['environment'])
              }
              disabled={busy}
              SelectProps={{ native: true }}
            >
              <option value="live">Production (live)</option>
              <option value="test">Sandbox (test)</option>
            </FormField>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <ActionButton
            variant="secondary"
            onClick={() => setOpen(false)}
            disabled={busy}
          >
            Cancel
          </ActionButton>
          <ActionButton
            onClick={handleCreate}
            loading={busy}
            disabled={!label.trim()}
          >
            Generate
          </ActionButton>
        </DialogActions>
      </Dialog>

      {/* One-shot plaintext reveal dialog */}
      <Dialog
        open={!!created}
        onClose={() => setCreated(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Token created — copy it now</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="warning">
              This is the only time the full token will be shown. If you lose it,
              you'll need to revoke it and generate a new one.
            </Alert>
            <FormField
              label="Token"
              value={created?.plaintext ?? ''}
              // Render full-contrast but read-only — locked is the FormField
              // contract for "you can read but can't change this value".
              locked
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      aria-label="Copy token"
                      onClick={handleCopy}
                      sx={{ color: TOKENS.textSecondary }}
                    >
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
                sx: {
                  fontFamily:
                    'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
                  fontSize: '0.8125rem',
                },
              }}
            />
            {copied && (
              <Caption sx={{ color: TOKENS.brandHover, display: 'block' }}>
                Copied to clipboard.
              </Caption>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <ActionButton variant="secondary" onClick={handleCopy}>
            Copy
          </ActionButton>
          <ActionButton onClick={() => setCreated(null)}>
            I've saved it
          </ActionButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
