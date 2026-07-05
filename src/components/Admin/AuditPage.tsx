import { useNavigate } from 'react-router-dom';
import AuditLogView from '../Audit/AuditLogView';
import { AdminService } from '../../services/admin.service';
import type { AuditListItem, AuditListQuery } from '../../services/audit.service';

export default function AuditPage() {
  const navigate = useNavigate();
  return (
    <AuditLogView
      title="Audit log"
      subtitle="Every privileged action on the platform."
      showCompany
      fetchPage={async (q: AuditListQuery) => {
        const r = await AdminService.audit(q as Record<string, unknown>);
        const data = (r.data ?? r) as { items?: AuditListItem[]; total?: number };
        return { items: data.items ?? [], total: data.total ?? 0 };
      }}
      onOpen={(row) => navigate(`/admin/audit/${row.id}`)}
    />
  );
}
