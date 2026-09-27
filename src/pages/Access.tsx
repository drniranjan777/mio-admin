import { useSearchParams } from 'react-router-dom';

import { api } from '../api/client';
import { Badge, Button, Card, Loadable, Pager, Select, Table } from '../components/ui';
import { fmtDate } from '../lib/format';
import type { AccessRow } from '../lib/types';
import { useAction } from '../lib/useAction';
import { useApi } from '../lib/useApi';

const PERMS = ['view', 'book', 'reschedule', 'cancel'] as const;

export function Access() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const page = Number(params.get('page') ?? 1);
  const state = useApi(() => api.get<AccessRow[]>('/admin/receptionist-access', { status, page, limit: 20 }), [status, page]);
  const { run, busy } = useAction();

  const update = async (row: AccessRow, body: { status?: string; permissions?: string[] }, msg: string) => {
    if (await run(() => api.patch(`/admin/receptionist-access/${row.id}`, body), msg)) state.reload();
  };

  const togglePerm = (row: AccessRow, p: string) => {
    const next = row.permissions.includes(p) ? row.permissions.filter((x) => x !== p) : [...row.permissions, p];
    update(row, { permissions: next }, 'Permissions updated');
  };

  return (
    <>
      <h1 className="page-title">Receptionist Access</h1>
      <p className="muted page-sub">
        Doctors normally manage their own receptionists in the app. Use this page to review requests or step in when a doctor asks for help.
      </p>
      <Card
        actions={
          <Select
            value={status}
            onChange={(v) => setParams(v ? { status: v } : {}, { replace: true })}
            options={[
              { value: 'pending', label: 'Pending requests' },
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ]}
            placeholder="All statuses"
          />
        }
      >
        <Loadable state={state}>
          {(rows) => (
            <>
              <Table
                rows={rows}
                empty="No access records."
                columns={[
                  { key: 'doctor', header: 'Doctor', render: (r) => r.doctor?.name ?? '—' },
                  {
                    key: 'rec',
                    header: 'Receptionist',
                    render: (r) => (
                      <>
                        {r.receptionist?.name || '—'}
                        <div className="muted small">{r.receptionist?.mobile}</div>
                      </>
                    ),
                  },
                  { key: 'status', header: 'Status', render: (r) => <Badge value={r.status} /> },
                  {
                    key: 'perms',
                    header: 'Permissions',
                    render: (r) => (
                      <div className="chips">
                        {PERMS.map((p) => (
                          <label key={p} className={`chip ${r.permissions.includes(p) ? 'on' : ''}`}>
                            <input
                              type="checkbox"
                              checked={r.permissions.includes(p)}
                              disabled={p === 'view' || busy}
                              onChange={() => togglePerm(r, p)}
                            />
                            {p}
                          </label>
                        ))}
                      </div>
                    ),
                  },
                  { key: 'updated', header: 'Updated', render: (r) => fmtDate(r.updatedAt) },
                  {
                    key: 'act',
                    header: '',
                    render: (r) =>
                      r.status === 'active' ? (
                        <Button variant="danger" size="sm" busy={busy} onClick={() => update(r, { status: 'inactive' }, 'Access deactivated')}>
                          Deactivate
                        </Button>
                      ) : (
                        <Button variant="success" size="sm" busy={busy} onClick={() => update(r, { status: 'active' }, r.status === 'pending' ? 'Request approved' : 'Access activated')}>
                          {r.status === 'pending' ? 'Approve' : 'Activate'}
                        </Button>
                      ),
                  },
                ]}
              />
              <Pager meta={state.meta} page={page} onPage={(p) => setParams({ ...(status && { status }), page: String(p) }, { replace: true })} />
            </>
          )}
        </Loadable>
      </Card>
    </>
  );
}
