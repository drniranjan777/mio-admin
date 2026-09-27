import { useState } from 'react';

import { api } from '../api/client';
import { Card, Loadable, Modal, Pager, Select, Table } from '../components/ui';
import { fmtDateTime, ROLE_LABEL } from '../lib/format';
import type { AuditRow } from '../lib/types';
import { useApi } from '../lib/useApi';
import { useDebounced } from '../lib/useDebounced';

export function Audit() {
  const [module, setModule] = useState('');
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<AuditRow | null>(null);
  const actionQ = useDebounced(action, 350);
  const state = useApi(() => api.get<AuditRow[]>('/admin/audit-logs', { module, action: actionQ, from, to, page, limit: 30 }), [module, actionQ, from, to, page]);
  const modules = (state.meta?.modules as string[] | undefined) ?? [];
  const reset = (fn: () => void) => {
    fn();
    setPage(1);
  };

  return (
    <>
      <h1 className="page-title">Audit Log</h1>
      <p className="muted page-sub">Every sign-in, change and payment is recorded here. Entries cannot be edited or deleted from the panel.</p>
      <Card
        actions={
          <>
            <Select value={module} onChange={(v) => reset(() => setModule(v))} options={modules.map((m) => ({ value: m, label: m }))} placeholder="All modules" />
            <input className="search" placeholder="Action starts with… (e.g. appointment.)" value={action} onChange={(e) => reset(() => setAction(e.target.value))} />
            <label className="inline-field">
              From <input type="date" value={from} onChange={(e) => reset(() => setFrom(e.target.value))} />
            </label>
            <label className="inline-field">
              To <input type="date" value={to} onChange={(e) => reset(() => setTo(e.target.value))} />
            </label>
          </>
        }
      >
        <Loadable state={state}>
          {(rows) => (
            <>
              <Table
                rows={rows}
                onRowClick={setOpen}
                empty="No entries for these filters."
                columns={[
                  { key: 'at', header: 'When', render: (r) => fmtDateTime(r.at) },
                  {
                    key: 'who',
                    header: 'Who',
                    render: (r) => (
                      <>
                        {r.actor.name || '—'}
                        <div className="muted small">{ROLE_LABEL[r.actor.role ?? ''] ?? r.actor.role}</div>
                      </>
                    ),
                  },
                  { key: 'action', header: 'Action', render: (r) => <code>{r.action}</code> },
                  { key: 'module', header: 'Module', render: (r) => r.module },
                  { key: 'entity', header: 'Record', render: (r) => (r.entityType ? `${r.entityType} ${r.entityId?.slice(-6) ?? ''}` : '—') },
                  { key: 'ip', header: 'IP', render: (r) => <span className="muted small">{r.ip ?? '—'}</span> },
                ]}
              />
              <Pager meta={state.meta} page={page} onPage={setPage} />
            </>
          )}
        </Loadable>
      </Card>
      {open && (
        <Modal title={open.action} onClose={() => setOpen(null)} wide>
          <div className="stack">
            <span className="muted">
              {fmtDateTime(open.at)} · {open.actor.name ?? open.actor.role} {open.actor.contact ? `(${open.actor.contact})` : ''} · {open.entityType} {open.entityId}
            </span>
            <div className="grid-2">
              <div>
                <h4>Before</h4>
                <pre className="json">{open.before === undefined ? '—' : JSON.stringify(open.before, null, 2)}</pre>
              </div>
              <div>
                <h4>After</h4>
                <pre className="json">{open.after === undefined ? '—' : JSON.stringify(open.after, null, 2)}</pre>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
