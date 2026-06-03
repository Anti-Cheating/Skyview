import { useEffect, useState } from 'react';
import {
  Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Table, TableHead, TableRow, TableCell, TableBody, IconButton,
  Alert, Stack, Chip, Tab, Tabs,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ReplayIcon from '@mui/icons-material/Replay';
import {
  WebhooksService, type WebhookEndpoint, type WebhookDelivery,
  type CreatedWebhookEndpoint, type WebhookEventType,
} from '../../services/webhooks.service';

const ALL_EVENTS: WebhookEventType[] = [
  'session.ready', 'session.transcript_segment', 'session.risk_pulse',
  'session.window_result', 'session.image_analysis_result', 'session.ended',
  'session.report_ready', 'session.cancelled',
];

export default function WebhooksPage() {
  const [tab, setTab] = useState(0);
  return (
    <Box>
      <Typography variant="h5" gutterBottom>Webhooks</Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Endpoints" />
        <Tab label="Delivery history" />
      </Tabs>
      {tab === 0 ? <EndpointsTab /> : <DeliveriesTab />}
    </Box>
  );
}

function EndpointsTab() {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [selected, setSelected] = useState<Set<WebhookEventType>>(new Set(['*']));
  const [created, setCreated] = useState<CreatedWebhookEndpoint | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => WebhooksService.listEndpoints().then(setEndpoints).catch((e) => setError(e?.message));
  useEffect(() => { load(); }, []);

  const toggle = (ev: WebhookEventType) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (ev === '*') {
        return prev.has('*') ? new Set() : new Set(['*']);
      }
      next.delete('*');
      next.has(ev) ? next.delete(ev) : next.add(ev);
      return next;
    });
  };

  const handleCreate = async () => {
    setError(null);
    try {
      const ev = selected.size > 0 ? Array.from(selected) : ['*'] as WebhookEventType[];
      const res = await WebhooksService.createEndpoint({ label, url, event_types: ev });
      setCreated(res);
      setOpen(false); setLabel(''); setUrl(''); setSelected(new Set(['*']));
      load();
    } catch (e: any) { setError(e?.message ?? 'Create failed'); }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Delete this endpoint? Existing deliveries are preserved.')) return;
    await WebhooksService.revokeEndpoint(id); load();
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="body2" color="text.secondary">
          Each endpoint receives signed POSTs for the events you select. Signing secret shown once.
        </Typography>
        <Button variant="contained" onClick={() => setOpen(true)}>Add endpoint</Button>
      </Stack>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Table size="small">
        <TableHead><TableRow>
          <TableCell>Label</TableCell><TableCell>URL</TableCell><TableCell>Events</TableCell>
          <TableCell>Status</TableCell><TableCell>Last delivery</TableCell><TableCell />
        </TableRow></TableHead>
        <TableBody>
          {endpoints.map((e) => (
            <TableRow key={e.id}>
              <TableCell>{e.label}</TableCell>
              <TableCell><code style={{ fontSize: 12 }}>{e.url}</code></TableCell>
              <TableCell>
                {e.event_types.includes('*') ? <Chip label="all" size="small" /> :
                  e.event_types.map((ev) => <Chip key={ev} label={ev} size="small" sx={{ mr: 0.5 }} />)}
              </TableCell>
              <TableCell>
                <Chip size="small" label={e.status}
                  color={e.status === 'active' ? 'success' : e.status === 'paused' ? 'warning' : 'error'} />
              </TableCell>
              <TableCell>{e.last_delivery_at ? new Date(e.last_delivery_at).toLocaleString() : '—'}</TableCell>
              <TableCell align="right">
                <IconButton size="small" onClick={() => handleRevoke(e.id)}><DeleteIcon fontSize="small" /></IconButton>
              </TableCell>
            </TableRow>
          ))}
          {endpoints.length === 0 && (
            <TableRow><TableCell colSpan={6} align="center" sx={{ color: 'text.secondary', py: 4 }}>
              No endpoints configured.
            </TableCell></TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Add webhook endpoint</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField label="Label" value={label} onChange={(e) => setLabel(e.target.value)} fullWidth />
            <TextField label="HTTPS URL" value={url} onChange={(e) => setUrl(e.target.value)} fullWidth placeholder="https://your-ats.com/webhooks/trueyy" />
            <Box>
              <Typography variant="subtitle2" gutterBottom>Subscribe to events</Typography>
              <Chip label="All events" onClick={() => toggle('*')}
                color={selected.has('*') ? 'primary' : 'default'} sx={{ mr: 1, mb: 1 }} />
              {ALL_EVENTS.map((ev) => (
                <Chip key={ev} label={ev} onClick={() => toggle(ev)}
                  color={selected.has(ev) ? 'primary' : 'default'} sx={{ mr: 1, mb: 1 }} />
              ))}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={!label.trim() || !url.trim()}>Create</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!created} onClose={() => setCreated(null)} maxWidth="md" fullWidth>
        <DialogTitle>Endpoint created — save your signing secret</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Shown ONCE. Use this with @trueyy/node's <code>webhooks.verify(secret)</code> middleware.
          </Alert>
          <TextField value={created?.signing_secret ?? ''} fullWidth multiline InputProps={{ readOnly: true, sx: { fontFamily: 'monospace' } }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreated(null)} variant="contained">I've saved it</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function DeliveriesTab() {
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const load = () => {
    setLoading(true);
    WebhooksService.listDeliveries({ limit: 100 })
      .then(setDeliveries)
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const handleRefire = async (id: string) => {
    await WebhooksService.refireDelivery(id);
    load();
  };

  if (loading) return <Typography>Loading…</Typography>;

  return (
    <Table size="small">
      <TableHead><TableRow>
        <TableCell>Event</TableCell><TableCell>Status</TableCell>
        <TableCell>HTTP</TableCell><TableCell>Attempts</TableCell>
        <TableCell>Created</TableCell><TableCell />
      </TableRow></TableHead>
      <TableBody>
        {deliveries.map((d) => (
          <TableRow key={d.id}>
            <TableCell>{d.event_type}</TableCell>
            <TableCell>
              <Chip size="small" label={d.status}
                color={d.status === 'succeeded' ? 'success' :
                       d.status === 'dead_lettered' ? 'error' :
                       d.status === 'failed' ? 'warning' : 'default'} />
            </TableCell>
            <TableCell>{d.http_status ?? '—'}</TableCell>
            <TableCell>{d.attempt_count}</TableCell>
            <TableCell>{new Date(d.created_at).toLocaleString()}</TableCell>
            <TableCell align="right">
              {(d.status === 'failed' || d.status === 'dead_lettered') && (
                <IconButton size="small" onClick={() => handleRefire(d.id)} title="Re-fire">
                  <ReplayIcon fontSize="small" />
                </IconButton>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
