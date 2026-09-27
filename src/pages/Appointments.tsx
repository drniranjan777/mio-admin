import { useState } from 'react';

import { api } from '../api/client';
import { Badge, Button, Card, Loadable, Pager, Select, Table } from '../components/ui';
import { fmtDate, ROLE_LABEL, titleCase } from '../lib/format';
import type { Appointment } from '../lib/types';
import { useAction } from '../lib/useAction';
import { useApi } from '../lib/useApi';
import { useConfirm } from '../components/ConfirmDialog';

type Status = Appointment['status'];

export function Appointments() {
  const [status, setStatus] = useState<Status | ''>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const state = useApi(
    () => api.get<Appointment[]>('/appointments', { status, from, to, page, limit: 25, sort: 'latest' }),
    [status, from, to, page],
  );
  const { run, busy } = useAction();
  const confirm = useConfirm();

  async function act(a: Appointment, action: 'approve' | 'reject' | 'complete' | 'cancel') {
    const copy = {
      approve: { title: 'Approve appointment?', label: 'Approve', tone: 'success' as const },
      reject: { title: 'Reject request?', label: 'Reject', tone: 'danger' as const },
      complete: { title: 'Mark as completed?', label: 'Mark completed', tone: 'primary' as const },
      cancel: { title: 'Cancel appointment?', label: 'Cancel appointment', tone: 'danger' as const },
    }[action];
    const ok = await confirm({
      title: copy.title,
      tone: copy.tone,
      confirmLabel: copy.label,
      cancelLabel: 'Go back',
      message: (
        <>
          <strong>{a.visitor.name}</strong>
          {a.visitor.company ? ` (${a.visitor.company})` : ''} with <strong>{a.doctor.name}</strong>
          <br />
          {fmtDate(a.startAt)} · {a.timeLabel}
          {action !== 'approve' && action !== 'complete' && <><br />The MR is notified.</>}
        </>
      ),
    });
    if (!ok) return;
    const body = action === 'cancel' || action === 'reject' ? { reason: 'By administrator' } : {};
    const done = { approve: 'approved', reject: 'rejected', complete: 'completed', cancel: 'cancelled' }[action];
    if (await run(() => api.post(`/appointments/${a.id}/${action}`, body), `Appointment ${done}`)) {
      state.reload();
    }
  }

  const reset = (fn: () => void) => {
    fn();
    setPage(1);
  };

  return (
    <>
      <h1 className="page-title">Appointments</h1>
      <Card
        actions={
          <>
            <label className="inline-field">
              From <input type="date" value={from} onChange={(e) => reset(() => setFrom(e.target.value))} />
            </label>
            <label className="inline-field">
              To <input type="date" value={to} onChange={(e) => reset(() => setTo(e.target.value))} />
            </label>
            <Select
              value={status}
              onChange={(v) => reset(() => setStatus(v))}
              options={(['pending', 'approved', 'completed', 'cancelled'] as const).map((s) => ({ value: s, label: titleCase(s) }))}
              placeholder="All statuses"
            />
          </>
        }
      >
        <Loadable state={state}>
          {(rows) => (
            <>
              <Table
                rows={rows}
                empty="No appointments for these filters."
                columns={[
                  {
                    key: 'when',
                    header: 'When',
                    render: (a) => (
                      <>
                        {fmtDate(a.startAt)}
                        <div className="muted small">{a.timeLabel}</div>
                      </>
                    ),
                  },
                  {
                    key: 'doctor',
                    header: 'Doctor',
                    render: (a) => (
                      <>
                        {a.doctor.name}
                        <div className="muted small">{a.doctor.specialty}</div>
                      </>
                    ),
                  },
                  {
                    key: 'mr',
                    header: 'MR / Visitor',
                    render: (a) => (
                      <>
                        {a.visitor.name}
                        <div className="muted small">{[a.visitor.company, a.visitor.division].filter(Boolean).join(' · ')}</div>
                      </>
                    ),
                  },
                  { key: 'by', header: 'Booked by', render: (a) => ROLE_LABEL[a.createdBy ?? ''] ?? '—' },
                  {
                    key: 'status',
                    header: 'Status',
                    render: (a) => (
                      <>
                        <Badge value={a.status} />
                        {a.cancel?.role && <div className="muted small">by {a.cancel.role}</div>}
                      </>
                    ),
                  },
                  {
                    key: 'act',
                    header: '',
                    render: (a) => (
                      <div className="row gap">
                        {a.can.approve && (
                          <Button size="sm" variant="success" busy={busy} onClick={() => act(a, 'approve')}>
                            Approve
                          </Button>
                        )}
                        {a.can.reject && (
                          <Button size="sm" variant="ghost" busy={busy} onClick={() => act(a, 'reject')}>
                            Reject
                          </Button>
                        )}
                        {a.can.complete && (
                          <Button size="sm" variant="ghost" busy={busy} onClick={() => act(a, 'complete')}>
                            Complete
                          </Button>
                        )}
                        {a.can.cancel && (
                          <Button size="sm" variant="danger" busy={busy} onClick={() => act(a, 'cancel')}>
                            Cancel
                          </Button>
                        )}
                      </div>
                    ),
                  },
                ]}
              />
              <Pager meta={state.meta} page={page} onPage={setPage} />
            </>
          )}
        </Loadable>
      </Card>
    </>
  );
}
