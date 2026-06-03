import { useEffect, useState } from 'react';
import {
  Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Table, TableHead, TableRow, TableCell, TableBody,
  IconButton, Alert, Stack,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { ApiTokensService, type ApiToken, type CreatedApiToken } from '../../services/apiTokens.service';

export default function ApiTokensPage() {
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [env, setEnv] = useState<'live' | 'test'>('live');
  const [created, setCreated] = useState<CreatedApiToken | null>(null);

  useEffect(() => {
    let alive = true;
    ApiTokensService.list()
      .then((data) => {
        if (alive) setTokens(data);
      })
      .catch((e) => alive && setError(e?.message ?? 'Failed to load'))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  const handleCreate = async () => {
    setError(null);
    try {
      const res = await ApiTokensService.create({ label, environment: env });
      setCreated(res);
      setTokens((prev) => [{
        id: res.id, prefix: res.prefix, label: res.label, environment: res.environment,
        last_used_at: null, created_at: res.created_at, expires_at: res.expires_at,
      }, ...prev]);
      setLabel('');
      setEnv('live');
      setOpen(false);
    } catch (e: any) {
      setError(e?.message ?? 'Create failed');
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Revoke this token? Any service using it will lose access immediately.')) return;
    await ApiTokensService.revoke(id);
    setTokens((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5">API Tokens</Typography>
        <Button variant="contained" onClick={() => setOpen(true)}>
          Generate token
        </Button>
      </Stack>

      <Typography variant="body2" color="text.secondary" mb={2}>
        Tokens authenticate your backend against /v1/*. Generated values are shown ONCE.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Typography>Loading…</Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Label</TableCell>
              <TableCell>Prefix</TableCell>
              <TableCell>Env</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Last used</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {tokens.map((t) => (
              <TableRow key={t.id}>
                <TableCell>{t.label}</TableCell>
                <TableCell><code>{t.prefix}…</code></TableCell>
                <TableCell>{t.environment}</TableCell>
                <TableCell>{new Date(t.created_at).toLocaleDateString()}</TableCell>
                <TableCell>{t.last_used_at ? new Date(t.last_used_at).toLocaleString() : '—'}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => handleRevoke(t.id)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {tokens.length === 0 && (
              <TableRow><TableCell colSpan={6} align="center" sx={{ color: 'text.secondary', py: 4 }}>
                No tokens yet. Generate your first one.
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Generate API token</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField label="Label" value={label} onChange={(e) => setLabel(e.target.value)} fullWidth autoFocus />
            <TextField select label="Environment" value={env} onChange={(e) => setEnv(e.target.value as 'live' | 'test')} fullWidth>
              <MenuItem value="live">Production (live)</MenuItem>
              <MenuItem value="test">Sandbox (test)</MenuItem>
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={!label.trim()}>Generate</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!created} onClose={() => setCreated(null)} maxWidth="md" fullWidth>
        <DialogTitle>Token created — copy now</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This is the ONLY time you'll see the full token. Store it securely.
          </Alert>
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField value={created?.plaintext ?? ''} fullWidth InputProps={{ readOnly: true, sx: { fontFamily: 'monospace' } }} />
            <IconButton onClick={() => { if (created) navigator.clipboard.writeText(created.plaintext); }}>
              <ContentCopyIcon />
            </IconButton>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreated(null)} variant="contained">I've saved it</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
