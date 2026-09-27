import { useState } from 'react';

import { api } from '../api/client';
import { Badge, Button, Card, Loadable, Modal, Pager, Select, Table } from '../components/ui';
import { fmtDateTime, ROLE_LABEL, titleCase } from '../lib/format';
import type { Person, Ticket } from '../lib/types';
import { useAction } from '../lib/useAction';
import { useApi } from '../lib/useApi';

const STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;

export function Tickets() {
  const [status, setStatus] = useState<Ticket['status'] | ''>('open');
  const [assigned, setAssigned] = useState('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignTo, setAssignTo] = useState('');
  const state = useApi(() => api.get<Ticket[]>('/help-tickets', { status, assigned, page, limit: 25 }), [status, assigned, page]);
  const assignees = useApi(() => api.get<Person[]>('/help-tickets/assignees'), []);
  const { run, busy } = useAction();

  const refilter = (fn: () => void) => {
    fn();
    setPage(1);
    setSelected(new Set());
  };
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function bulkAssign() {
    const target = assignTo === 'none' ? null : assignTo;
    const who = target ? assignees.data?.find((a) => a.id === target)?.name : 'nobody';
    const res = await run(() => api.post<{ updated: number }>('/help-tickets/assign', { ticketIds: [...selected], assignedTo: target }), `Assigned ${selected.size} request(s) to ${who}`);
    if (res) {
      setSelected(new Set());
      setAssignTo('');
      state.reload();
    }
  }

  const people = assignees.data ?? [];
  return (
    <>
      <h1 className="page-title">Help Desk</h1>
      <Card
        actions={
          <>
            <Select
              value={assigned}
              onChange={(v) => refilter(() => setAssigned(v))}
              options={[{ value: 'me', label: 'Assigned to me' }, { value: 'none', label: 'Unassigned' }, ...people.map((p) => ({ value: p.id, label: `Assigned to ${p.name}` }))]}
              placeholder="Anyone"
            />
            <Select value={status} onChange={(v) => refilter(() => setStatus(v))} options={STATUSES.map((s) => ({ value: s, label: titleCase(s) }))} placeholder="All statuses" />
          </>
        }
      >
        {selected.size > 0 && (
          <div className="bulk-bar">
            <strong>{selected.size} selected</strong>
            <select value={assignTo} onChange={(e) => setAssignTo(e.target.value)} aria-label="Assign to">
              <option value="">Assign to…</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
              <option value="none">— Unassign —</option>
            </select>
            <Button size="sm" busy={busy} disabled={!assignTo} onClick={bulkAssign}>
              Apply
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        )}
        <Loadable state={state}>
          {(rows) => (
            <>
              <Table
                rows={rows}
                onRowClick={(t) => setOpenId(t.id)}
                empty="No help requests here."
                columns={[
                  {
                    key: 'sel',
                    width: '36px',
                    header: (
                      <input
                        type="checkbox"
                        aria-label="Select all"
                        checked={rows.length > 0 && rows.every((r) => selected.has(r.id))}
                        onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())}
                      />
                    ),
                    render: (t) => (
                      <input type="checkbox" aria-label={`Select ${t.number}`} checked={selected.has(t.id)} onClick={(e) => e.stopPropagation()} onChange={() => toggle(t.id)} />
                    ),
                  },
                  { key: 'no', header: 'Request', render: (t) => <code>{t.number}</code> },
                  {
                    key: 'from',
                    header: 'From',
                    render: (t) => (
                      <>
                        {t.user?.name || '—'}
                        <div className="muted small">
                          {ROLE_LABEL[t.role ?? '']} · {t.user?.mobile}
                        </div>
                      </>
                    ),
                  },
                  { key: 'cat', header: 'Category', render: (t) => t.category },
                  { key: 'msg', header: 'Message', render: (t) => <span className="clamp">{t.message}</span> },
                  { key: 'who', header: 'Assigned to', render: (t) => t.assignedTo?.name ?? <span className="muted">Unassigned</span> },
                  { key: 'st', header: 'Status', render: (t) => <Badge value={t.status} /> },
                  { key: 'at', header: 'Raised', render: (t) => fmtDateTime(t.createdAt) },
                ]}
              />
              <Pager meta={state.meta} page={page} onPage={setPage} />
            </>
          )}
        </Loadable>
      </Card>
      {openId && <TicketModal id={openId} assignees={people} onClose={() => setOpenId(null)} onChanged={state.reload} />}
    </>
  );
}

function TicketModal({ id, assignees, onClose, onChanged }: { id: string; assignees: Person[]; onClose: () => void; onChanged: () => void }) {
  const state = useApi(() => api.get<Ticket>(`/help-tickets/${id}`), [id]);
  const { run, busy } = useAction();
  const [reply, setReply] = useState('');

  const refresh = () => {
    state.reload();
    onChanged();
  };

  async function send() {
    if (!reply.trim()) return;
    if (await run(() => api.post(`/help-tickets/${id}/replies`, { message: reply.trim() }), 'Reply sent — the user is notified')) {
      setReply('');
      refresh();
    }
  }

  async function update(body: { status?: Ticket['status']; assignedTo?: string | null }, msg: string) {
    if (await run(() => api.patch(`/help-tickets/${id}`, body), msg)) refresh();
  }

  return (
    <Modal title="Help request" onClose={onClose} wide>
      <Loadable state={state}>
        {(t) => (
          <div className="stack">
            <div className="row between">
              <div>
                <strong>
                  {t.number} · {t.category}
                </strong>
                <div className="muted small">Raised {fmtDateTime(t.createdAt)}</div>
              </div>
              <div className="row gap">
                <select
                  aria-label="Assigned to"
                  value={t.assignedTo?.id ?? ''}
                  disabled={busy}
                  onChange={(e) => update({ assignedTo: e.target.value || null }, e.target.value ? 'Assigned' : 'Unassigned')}
                >
                  <option value="">Unassigned</option>
                  {assignees.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                <Badge value={t.status} />
              </div>
            </div>
            <div className="thread">
              <div className="msg msg-user">
                <span className="muted small">User</span>
                <p>{t.message}</p>
              </div>
              {t.replies?.map((r, i) => (
                <div key={i} className={`msg ${r.fromSupport ? 'msg-support' : 'msg-user'}`}>
                  <span className="muted small">
                    {r.fromSupport ? 'Support' : 'User'} · {fmtDateTime(r.at)}
                  </span>
                  <p>{r.message}</p>
                </div>
              ))}
            </div>
            {t.status !== 'closed' ? (
              <>
                <textarea rows={3} maxLength={1000} placeholder="Write a reply to the user…" value={reply} onChange={(e) => setReply(e.target.value)} />
                <div className="row gap">
                  <Button busy={busy} onClick={send} disabled={!reply.trim()}>
                    Send reply
                  </Button>
                  <div className="spacer" />
                  {t.status !== 'resolved' && (
                    <Button variant="success" busy={busy} onClick={() => update({ status: 'resolved' }, 'Marked resolved')}>
                      Mark resolved
                    </Button>
                  )}
                  <Button variant="ghost" busy={busy} onClick={() => update({ status: 'closed' }, 'Closed')}>
                    Close
                  </Button>
                </div>
              </>
            ) : (
              <Button variant="ghost" busy={busy} onClick={() => update({ status: 'open' }, 'Reopened')}>
                Reopen
              </Button>
            )}
          </div>
        )}
      </Loadable>
    </Modal>
  );
}
