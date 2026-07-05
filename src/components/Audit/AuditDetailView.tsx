import { Box, Chip, Divider, IconButton } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';
import { TOKENS } from '../../theme';
import { PageTitle, Secondary, Caption } from '../layout/Typography';
import { ActionChip } from './AuditLogView';
import type { AuditDetail } from '../../services/audit.service';

const fmtDate = (v: string | null | undefined): string => (v ? new Date(v).toLocaleString() : '—');

/** Pretty JSON block for details / old_value / new_value. */
function JsonBlock({ label, value, tone }: { label: string; value: unknown; tone?: 'old' | 'new' }) {
  if (value === null || value === undefined) return null;
  let body: string;
  try { body = JSON.stringify(value, null, 2); } catch { body = String(value); }
  const border = tone === 'old' ? '#FECACA' : tone === 'new' ? '#BBF7D0' : '#E5E7EB';
  const bg = tone === 'old' ? '#FEF2F2' : tone === 'new' ? '#F0FDF4' : '#FAFAFA';
  return (
    <Box sx={{ flex: 1, minWidth: 260 }}>
      <Caption sx={{ color: TOKENS.textSecondary, fontWeight: 600, display: 'block', mb: 0.5 }}>{label}</Caption>
      <Box
        component="pre"
        sx={{
          m: 0, p: 1.5, borderRadius: 1.5, border: `1px solid ${border}`, bgcolor: bg,
          fontSize: '0.78rem', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowX: 'auto', maxHeight: 420, overflowY: 'auto',
        }}
      >
        {body}
      </Box>
    </Box>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box sx={{ minWidth: 180 }}>
      <Caption sx={{ color: TOKENS.textSecondary, fontWeight: 600, display: 'block' }}>{label}</Caption>
      <Caption sx={{ color: TOKENS.textPrimary, fontSize: '0.85rem' }}>{children}</Caption>
    </Box>
  );
}

export default function AuditDetailView({ detail, backTo }: { detail: AuditDetail; backTo: string }) {
  const navigate = useNavigate();
  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
        <IconButton size="small" onClick={() => navigate(backTo)} aria-label="Back to audit log">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <PageTitle sx={{ color: TOKENS.textPrimary }}>Audit entry</PageTitle>
        <ActionChip action={detail.action} />
      </Box>
      <Secondary sx={{ color: TOKENS.textSecondary, mb: 3, ml: 5.5 }}>
        {fmtDate(detail.created_at)} · {detail.id}
      </Secondary>

      <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap', mb: 3 }}>
        <Field label="Actor">
          {detail.actor_name ?? 'system'}
          {detail.actor_role && (
            <Chip label={detail.actor_role} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.65rem', ml: 0.75 }} />
          )}
        </Field>
        <Field label="Actor email">{detail.actor_email ?? '—'}</Field>
        {detail.company_name !== undefined && <Field label="Company">{detail.company_name ?? detail.company_id ?? '—'}</Field>}
        <Field label="Entity">
          {detail.entity_type ? `${detail.entity_type}${detail.entity_id ? ` · ${detail.entity_id}` : ''}` : '—'}
        </Field>
        <Field label="IP address">{detail.ip_address ?? '—'}</Field>
        <Field label="User agent">
          <Box component="span" sx={{ wordBreak: 'break-all' }}>{detail.user_agent ?? '—'}</Box>
        </Field>
      </Box>

      <Divider sx={{ mb: 3 }} />

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <JsonBlock label="Details" value={detail.details} />
        {(detail.old_value != null || detail.new_value != null) && (
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <JsonBlock label="Old value" value={detail.old_value} tone="old" />
            <JsonBlock label="New value" value={detail.new_value} tone="new" />
          </Box>
        )}
        {detail.details == null && detail.old_value == null && detail.new_value == null && (
          <Caption sx={{ color: TOKENS.textSecondary }}>
            No payload recorded for this action — the envelope above is the full record.
          </Caption>
        )}
      </Box>
    </Box>
  );
}
