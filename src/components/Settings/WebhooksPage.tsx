/**
 * WebhooksPage — /settings/webhooks tab.
 *
 * The shell (SettingsLayout) already renders a top-of-page <PageTitle>Settings</PageTitle>
 * and the horizontal tab strip, so this view starts with a <SectionHeading>
 * + primary action and renders two stacked DataTables:
 *
 *   1. Endpoints       — the URLs we POST to, plus per-row actions
 *                        (rotate secret, pause/resume, delete) hidden behind
 *                        a 3-dot menu.
 *   2. Recent deliveries — most-recent delivery attempts, with a Re-fire
 *                          button for failed / dead-lettered rows.
 *
 * All status / lifecycle states are shown with the soft-tinted StatusPill
 * defined in design-patterns.md — never a raw MUI <Chip>.
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
  Menu,
  MenuItem,
  ListItemText,
  Checkbox,
  Select,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import {
  MoreVert as MoreVertIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import {
  SectionHeading,
  CardTitle,
  Body,
  Secondary,
  Caption,
} from '../layout/Typography';
import { DataTable, type DataTableColumn } from '../common/DataTable';
import { ActionButton } from '../common/ActionButton';
import { FormField } from '../common/FormField';
import { INPUT_SX, LABEL_SX } from '../common/formTokens';
import { TOKENS } from '../../theme';
import { useSnackbar } from '../../contexts/SnackbarContext';
import {
  WebhooksService,
  type WebhookEndpoint,
  type WebhookDelivery,
  type CreatedWebhookEndpoint,
  type WebhookEventType,
} from '../../services/webhooks.service';

// ── Constants ───────────────────────────────────────────────────────

const ALL_EVENTS: WebhookEventType[] = [
  'session.ready',
  'session.transcript_segment',
  'session.risk_pulse',
  'session.window_result',
  'session.image_analysis_result',
  'session.ended',
  'session.report_ready',
  'session.cancelled',
];

const ENDPOINTS_PAGE_SIZE = 10;
const DELIVERIES_PAGE_SIZE = 10;

// ── Status pill (soft-tinted, matches design-patterns.md matrix) ────

type PillTone = 'success' | 'error' | 'warning' | 'neutral';

const PILL_COLORS: Record<PillTone, { bg: string; fg: string }> = {
  success: { bg: 'rgba(34,197,94,0.12)', fg: '#15803D' },
  error:   { bg: 'rgba(239,68,68,0.12)', fg: '#B91C1C' },
  warning: { bg: 'rgba(234,179,8,0.12)', fg: '#A16207' },
  neutral: { bg: '#F3F4F6',              fg: '#4B5563' },
};

function endpointTone(status: WebhookEndpoint['status']): PillTone {
  if (status === 'active') return 'success';
  if (status === 'paused') return 'warning';
  return 'error'; // disabled_by_failures
}

function deliveryTone(status: WebhookDelivery['status']): PillTone {
  if (status === 'succeeded') return 'success';
  if (status === 'failed' || status === 'dead_lettered') return 'error';
  if (status === 'pending') return 'warning';
  return 'neutral';
}

function StatusPill({ label, tone }: { label: string; tone: PillTone }) {
  const c = PILL_COLORS[tone];
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
      {label.replace(/_/g, ' ')}
    </Box>
  );
}

// ── EventTypesField ──────────────────────────────────────────────────
// FormField's `select` mode is single-value only, but the design system
// calls for a multi-checkbox dropdown here. We isolate that styling into
// a local component that visually matches FormField: external <label>,
// shared INPUT_SX on the input, `size="small"`, full width. This keeps the
// rhythm (label height, gap, input height, focus ring) consistent with
// every other field in the dialog so the form doesn't feel "off".

interface EventTypesFieldProps {
  value: WebhookEventType[];
  onChange: (e: SelectChangeEvent<WebhookEventType[]>) => void;
  disabled?: boolean;
  required?: boolean;
}

function EventTypesField({ value, onChange, disabled, required }: EventTypesFieldProps) {
  return (
    <Box>
      <Box component="label" sx={LABEL_SX}>
        <span>Event types</span>
        {required && (
          <Box
            component="span"
            aria-hidden="true"
            sx={{ color: TOKENS.errorLight, fontWeight: 700 }}
          >
            *
          </Box>
        )}
      </Box>
      <Select<WebhookEventType[]>
        multiple
        value={value}
        onChange={onChange}
        disabled={disabled}
        fullWidth
        size="small"
        renderValue={(vals) => {
          if (vals.includes('*')) return 'All events';
          if (vals.length === 0) return '';
          return vals.join(', ');
        }}
        sx={INPUT_SX}
      >
        <MenuItem value="*">
          <Checkbox checked={value.includes('*')} />
          <ListItemText primary="All events" />
        </MenuItem>
        {ALL_EVENTS.map((ev) => (
          <MenuItem key={ev} value={ev} disabled={value.includes('*')}>
            <Checkbox checked={value.includes(ev)} />
            <ListItemText primary={ev} />
          </MenuItem>
        ))}
      </Select>
    </Box>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────

function fmtEvents(events: WebhookEventType[]): string {
  if (events.includes('*')) return 'All events';
  return events.join(', ');
}

function fmtTimestamp(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fmtDurationMs(ms: number | null): string {
  if (ms == null || Number.isNaN(ms) || ms < 0) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function deliveryDurationMs(d: WebhookDelivery): number | null {
  if (!d.delivered_at) return null;
  const start = Date.parse(d.created_at);
  const end = Date.parse(d.delivered_at);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return end - start;
}

// ── Page ────────────────────────────────────────────────────────────

export default function WebhooksPage() {
  const { showError, showSuccess } = useSnackbar();

  // Lists
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [endpointsLoading, setEndpointsLoading] = useState(true);
  const [deliveriesLoading, setDeliveriesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Client-side pagination — the API returns all rows in one shot.
  const [endpointsPage, setEndpointsPage] = useState(1);
  const [deliveriesPage, setDeliveriesPage] = useState(1);

  // Create-endpoint dialog
  const [addOpen, setAddOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<WebhookEventType[]>(['*']);
  const [creating, setCreating] = useState(false);

  // "Secret revealed once" dialog after create / rotate
  const [secretEndpoint, setSecretEndpoint] = useState<{ label: string; secret: string } | null>(null);

  // Per-row 3-dot menu
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuEndpoint, setMenuEndpoint] = useState<WebhookEndpoint | null>(null);

  // Per-row busy markers (so refire/rotate/pause spinners don't bleed across rows)
  const [busyEndpointId, setBusyEndpointId] = useState<string | null>(null);
  const [busyDeliveryId, setBusyDeliveryId] = useState<string | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<WebhookEndpoint | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Loaders ───────────────────────────────────────────────────────

  const loadEndpoints = async () => {
    setEndpointsLoading(true);
    try {
      const data = await WebhooksService.listEndpoints();
      setEndpoints(data);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load endpoints');
    } finally {
      setEndpointsLoading(false);
    }
  };

  const loadDeliveries = async () => {
    setDeliveriesLoading(true);
    try {
      const data = await WebhooksService.listDeliveries({ limit: 100 });
      setDeliveries(data);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load deliveries');
    } finally {
      setDeliveriesLoading(false);
    }
  };

  useEffect(() => {
    loadEndpoints();
    loadDeliveries();
  }, []);

  // ── Pagination slices ─────────────────────────────────────────────

  const pagedEndpoints = useMemo(() => {
    const start = (endpointsPage - 1) * ENDPOINTS_PAGE_SIZE;
    return endpoints.slice(start, start + ENDPOINTS_PAGE_SIZE);
  }, [endpoints, endpointsPage]);

  const pagedDeliveries = useMemo(() => {
    const start = (deliveriesPage - 1) * DELIVERIES_PAGE_SIZE;
    return deliveries.slice(start, start + DELIVERIES_PAGE_SIZE);
  }, [deliveries, deliveriesPage]);

  // ── Endpoint actions ──────────────────────────────────────────────

  const openMenu = (e: React.MouseEvent<HTMLElement>, ep: WebhookEndpoint) => {
    setMenuAnchor(e.currentTarget);
    setMenuEndpoint(ep);
  };
  const closeMenu = () => {
    setMenuAnchor(null);
    setMenuEndpoint(null);
  };

  const resetCreateForm = () => {
    setLabel('');
    setUrl('');
    setSelectedEvents(['*']);
  };

  const handleCreate = async () => {
    setError(null);
    setCreating(true);
    try {
      const events = selectedEvents.length > 0 ? selectedEvents : (['*'] as WebhookEventType[]);
      const res: CreatedWebhookEndpoint = await WebhooksService.createEndpoint({
        label: label.trim(),
        url: url.trim(),
        event_types: events,
      });
      setSecretEndpoint({ label: res.label, secret: res.signing_secret });
      setAddOpen(false);
      resetCreateForm();
      loadEndpoints();
      showSuccess(`Endpoint "${res.label}" created`);
    } catch (e: any) {
      setError(e?.message ?? 'Create failed');
      showError(e?.message ?? 'Create failed');
    } finally {
      setCreating(false);
    }
  };

  const handleRotate = async (ep: WebhookEndpoint) => {
    setBusyEndpointId(ep.id);
    try {
      const secret = await WebhooksService.rotateSecret(ep.id);
      setSecretEndpoint({ label: ep.label, secret });
      showSuccess(`Signing secret rotated for "${ep.label}"`);
    } catch (e: any) {
      showError(e?.message ?? 'Rotate failed');
    } finally {
      setBusyEndpointId(null);
    }
  };

  const handleTogglePause = async (ep: WebhookEndpoint) => {
    const nextStatus: 'active' | 'paused' = ep.status === 'paused' ? 'active' : 'paused';
    setBusyEndpointId(ep.id);
    try {
      await WebhooksService.updateEndpoint(ep.id, { status: nextStatus });
      showSuccess(
        nextStatus === 'paused'
          ? `"${ep.label}" paused`
          : `"${ep.label}" resumed`,
      );
      loadEndpoints();
    } catch (e: any) {
      showError(e?.message ?? 'Update failed');
    } finally {
      setBusyEndpointId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await WebhooksService.revokeEndpoint(deleteTarget.id);
      showSuccess(`"${deleteTarget.label}" deleted`);
      setDeleteTarget(null);
      loadEndpoints();
    } catch (e: any) {
      showError(e?.message ?? 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  // ── Delivery actions ──────────────────────────────────────────────

  const handleRefire = async (d: WebhookDelivery) => {
    setBusyDeliveryId(d.id);
    try {
      await WebhooksService.refireDelivery(d.id);
      showSuccess('Re-fired delivery');
      loadDeliveries();
    } catch (e: any) {
      showError(e?.message ?? 'Re-fire failed');
    } finally {
      setBusyDeliveryId(null);
    }
  };

  // ── Events Select handler (multi-checkbox) ────────────────────────

  const handleEventsChange = (e: SelectChangeEvent<WebhookEventType[]>) => {
    const value = e.target.value;
    const next = (typeof value === 'string' ? value.split(',') : value) as WebhookEventType[];
    if (next.includes('*')) {
      // "All events" is exclusive — selecting it clears the per-event picks
      // (and vice versa). Keeps the API payload sane: either ['*'] or a list.
      const prevAll = selectedEvents.includes('*');
      const justAdded = !prevAll && next.includes('*');
      if (justAdded) {
        setSelectedEvents(['*']);
        return;
      }
      // user reselected "*" while it was already on — toggle off
      setSelectedEvents(next.filter((ev) => ev !== '*'));
      return;
    }
    setSelectedEvents(next);
  };

  // ── Columns ───────────────────────────────────────────────────────

  const endpointColumns = useMemo<DataTableColumn<WebhookEndpoint>[]>(() => [
    {
      key: 'label',
      header: 'Label',
      render: (ep) => <Body sx={{ fontWeight: 600 }}>{ep.label}</Body>,
    },
    {
      key: 'url',
      header: 'URL',
      render: (ep) => (
        <Caption
          sx={{
            fontFamily:
              'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace',
            color: TOKENS.textSecondary,
            fontSize: '0.8125rem',
            display: 'block',
            maxWidth: 280,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={ep.url}
        >
          {ep.url}
        </Caption>
      ),
    },
    {
      key: 'events',
      header: 'Events',
      hideOn: 'mobile',
      render: (ep) => (
        <Caption sx={{ color: TOKENS.textSecondary, fontSize: '0.8125rem' }}>
          {fmtEvents(ep.event_types)}
        </Caption>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: 130,
      render: (ep) => <StatusPill label={ep.status} tone={endpointTone(ep.status)} />,
    },
    {
      key: 'failures',
      header: 'Failures',
      hideOn: 'mobile',
      width: 100,
      render: (ep) => (
        <Caption sx={{ color: TOKENS.textSecondary, fontSize: '0.8125rem' }}>
          {ep.consecutive_failures}
        </Caption>
      ),
    },
    {
      key: 'last',
      header: 'Last delivery',
      hideOn: 'mobile',
      width: 180,
      render: (ep) => (
        <Caption sx={{ color: TOKENS.textSecondary, fontSize: '0.8125rem' }}>
          {fmtTimestamp(ep.last_delivery_at)}
        </Caption>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: 48,
      render: (ep) => (
        <IconButton
          size="small"
          onClick={(e) => openMenu(e, ep)}
          disabled={busyEndpointId === ep.id}
          aria-label="Row actions"
          sx={{ color: TOKENS.textSecondary }}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      ),
    },
  ], [busyEndpointId]);

  const deliveryColumns = useMemo<DataTableColumn<WebhookDelivery>[]>(() => [
    {
      key: 'event',
      header: 'Event',
      render: (d) => (
        <Caption
          sx={{
            fontFamily:
              'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace',
            color: TOKENS.textPrimary,
            fontSize: '0.8125rem',
          }}
        >
          {d.event_type}
        </Caption>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: 140,
      render: (d) => <StatusPill label={d.status} tone={deliveryTone(d.status)} />,
    },
    {
      key: 'http',
      header: 'HTTP',
      width: 80,
      hideOn: 'mobile',
      render: (d) => (
        <Caption sx={{ color: TOKENS.textSecondary, fontSize: '0.8125rem' }}>
          {d.http_status ?? '—'}
        </Caption>
      ),
    },
    {
      key: 'attempts',
      header: 'Attempts',
      width: 100,
      hideOn: 'mobile',
      render: (d) => (
        <Caption sx={{ color: TOKENS.textSecondary, fontSize: '0.8125rem' }}>
          {d.attempt_count}
        </Caption>
      ),
    },
    {
      key: 'duration',
      header: 'Duration',
      width: 110,
      hideOn: 'mobile',
      render: (d) => (
        <Caption sx={{ color: TOKENS.textSecondary, fontSize: '0.8125rem' }}>
          {fmtDurationMs(deliveryDurationMs(d))}
        </Caption>
      ),
    },
    {
      key: 'created',
      header: 'Created',
      width: 180,
      hideOn: 'mobile',
      render: (d) => (
        <Caption sx={{ color: TOKENS.textSecondary, fontSize: '0.8125rem' }}>
          {fmtTimestamp(d.created_at)}
        </Caption>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: 120,
      render: (d) => {
        const canRefire = d.status === 'failed' || d.status === 'dead_lettered';
        if (!canRefire) return null;
        return (
          <ActionButton
            variant="secondary"
            onClick={() => handleRefire(d)}
            loading={busyDeliveryId === d.id}
          >
            Re-fire
          </ActionButton>
        );
      },
    },
  ], [busyDeliveryId]);

  // ── Render ────────────────────────────────────────────────────────

  return (
    <Box>
      {/* Section header — NOT a PageTitle (SettingsLayout owns that). */}
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 3 }}
      >
        <Box>
          <SectionHeading>Webhooks</SectionHeading>
          <Secondary>Each endpoint receives signed POSTs for the events you select. The signing secret is shown only once at create or rotate time.</Secondary>
        </Box>
        <ActionButton
          startIcon={<AddIcon sx={{ fontSize: 16 }} />}
          onClick={() => {
            resetCreateForm();
            setAddOpen(true);
          }}
        >
          Add endpoint
        </ActionButton>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* ── Endpoints ─────────────────────────────────────────────── */}
      <CardTitle sx={{ mb: 1.5 }}>Endpoints</CardTitle>
      <Box sx={{ mb: 4 }}>
        <DataTable<WebhookEndpoint>
          columns={endpointColumns}
          rows={pagedEndpoints}
          rowKey={(ep) => ep.id}
          loading={endpointsLoading}
          emptyState={<Secondary>No endpoints configured.</Secondary>}
          pagination={{
            page: endpointsPage,
            pageSize: ENDPOINTS_PAGE_SIZE,
            total: endpoints.length,
            showSizeChanger: false,
            onChange: (next) => setEndpointsPage(next),
          }}
        />
      </Box>

      {/* ── Recent deliveries ─────────────────────────────────────── */}
      <CardTitle sx={{ mb: 1.5 }}>Recent deliveries</CardTitle>
      <Box>
        <DataTable<WebhookDelivery>
          columns={deliveryColumns}
          rows={pagedDeliveries}
          rowKey={(d) => d.id}
          loading={deliveriesLoading}
          emptyState={<Secondary>No deliveries yet.</Secondary>}
          pagination={{
            page: deliveriesPage,
            pageSize: DELIVERIES_PAGE_SIZE,
            total: deliveries.length,
            showSizeChanger: false,
            onChange: (next) => setDeliveriesPage(next),
          }}
        />
      </Box>

      {/* ── Row actions menu (endpoints) ──────────────────────────── */}
      <Menu
        anchorEl={menuAnchor}
        open={!!menuAnchor}
        onClose={closeMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem
          onClick={() => {
            if (menuEndpoint) handleRotate(menuEndpoint);
            closeMenu();
          }}
        >
          Rotate secret
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuEndpoint) handleTogglePause(menuEndpoint);
            closeMenu();
          }}
          disabled={menuEndpoint?.status === 'disabled_by_failures'}
        >
          {menuEndpoint?.status === 'paused' ? 'Resume' : 'Pause'}
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuEndpoint) setDeleteTarget(menuEndpoint);
            closeMenu();
          }}
          sx={{ color: TOKENS.error }}
        >
          Delete
        </MenuItem>
      </Menu>

      {/* ── Add endpoint dialog ───────────────────────────────────── */}
      <Dialog open={addOpen} onClose={() => !creating && setAddOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add webhook endpoint</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Secondary>
              We'll POST signed payloads to this URL whenever one of the subscribed events fires.
            </Secondary>
            <FormField
              autoFocus
              label="Label"
              required
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              disabled={creating}
              placeholder="ATS production"
            />
            <FormField
              label="HTTPS URL"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={creating}
              placeholder="https://your-ats.com/webhooks/trueyy"
            />
            <EventTypesField
              value={selectedEvents}
              onChange={handleEventsChange}
              disabled={creating}
              required
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <ActionButton variant="secondary" onClick={() => setAddOpen(false)} disabled={creating}>
            Cancel
          </ActionButton>
          <ActionButton
            onClick={handleCreate}
            loading={creating}
            disabled={!label.trim() || !url.trim() || selectedEvents.length === 0}
          >
            Create endpoint
          </ActionButton>
        </DialogActions>
      </Dialog>

      {/* ── Delete confirmation dialog ────────────────────────────── */}
      <Dialog
        open={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Delete webhook endpoint</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Secondary>
              Delete <strong>{deleteTarget?.label}</strong>? New events won't be delivered to this
              URL. Existing delivery history is preserved for audit.
            </Secondary>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <ActionButton variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
            Cancel
          </ActionButton>
          <ActionButton onClick={handleDelete} loading={deleting}>
            Delete
          </ActionButton>
        </DialogActions>
      </Dialog>

      {/* ── Signing-secret reveal dialog ──────────────────────────── */}
      <Dialog
        open={!!secretEndpoint}
        onClose={() => setSecretEndpoint(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Signing secret for "{secretEndpoint?.label}"</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="warning">
              Shown only once. Copy it now — we can't show it again. Pair it with{' '}
              <code>@trueyy/node</code>'s <code>webhooks.verify(secret)</code> middleware.
            </Alert>
            <FormField
              label="Signing secret"
              value={secretEndpoint?.secret ?? ''}
              multiline
              minRows={2}
              InputProps={{
                readOnly: true,
                sx: {
                  fontFamily:
                    'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace',
                  fontSize: '0.8125rem',
                },
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <ActionButton
            variant="secondary"
            onClick={() => {
              if (secretEndpoint) navigator.clipboard.writeText(secretEndpoint.secret);
              showSuccess('Signing secret copied to clipboard');
            }}
          >
            Copy
          </ActionButton>
          <ActionButton onClick={() => setSecretEndpoint(null)}>
            I've saved it
          </ActionButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
