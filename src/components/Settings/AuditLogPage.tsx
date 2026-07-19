import { useNavigate } from 'react-router-dom';
import AuditLogView from '../Audit/AuditLogView';
import { CompanyAuditService, type AuditListQuery } from '../../services/audit.service';

/** Company-scoped audit trail for Owner/Admin — what THEIR team and API
 *  keys did. Platform-staff operations are filtered server-side. */
export default function AuditLogPage() {
  const navigate = useNavigate();
  return (
    <AuditLogView
      title="Audit log"
      subtitle="Every account, interview, and integration action taken by your team."
      customerActions
      fetchPage={async (q: AuditListQuery) => {
        const r = await CompanyAuditService.list(q);
        return { items: r.data?.items ?? [], total: r.data?.total ?? 0 };
      }}
      onOpen={(row) => navigate(`/audit-log/${row.id}`)}
    />
  );
}
