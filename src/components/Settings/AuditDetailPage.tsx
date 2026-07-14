import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box } from '@mui/material';
import AuditDetailView from '../Audit/AuditDetailView';
import { CompanyAuditService, type AuditDetail } from '../../services/audit.service';
import { LoadingSpinner } from '../common';
import { useSnackbar } from '../../contexts/SnackbarContext';

export default function AuditDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { showError } = useSnackbar();
  const [detail, setDetail] = useState<AuditDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    CompanyAuditService.detail(id)
      .then((r) => setDetail(r.data ?? null))
      .catch((e: unknown) => showError((e as Error)?.message || 'Failed to load audit entry'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) return <LoadingSpinner fullScreen message="Loading audit entry..." />;
  if (!detail) return <Box sx={{ p: 3 }}>Audit entry not found.</Box>;
  return <AuditDetailView detail={detail} backTo="/audit-log" />;
}
