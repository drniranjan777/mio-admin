import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { api } from '../api/client';
import { useConfirm } from '../components/ConfirmDialog';
import { Badge, Button, Card, Field, Loadable, Modal, Pager, Select, Table } from '../components/ui';
import { fmtDateTime, ROLE_LABEL } from '../lib/format';
import type { RecoveryRequest } from '../lib/types';
import { useAction } from '../lib/useAction';
import { useApi } from '../lib/useApi';

/**
 * "Changed your mobile number?" requests from the app. The new number is
 * already proven by OTP; the reviewer confirms the person owns the old
 * account (call them, check the Mio code / name) before approving.
 */
export function Recovery() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? 'pending';
  const page = Number(params.get('page') ?? 1);
  const state = useApi(() => api.get<RecoveryRequest[]>('/admin/recovery-requests', { status, page, limit: 20 }), [status, page]);
  const [reviewing, setReviewing] = useState<RecoveryRequest | null>(null);

  return (
    <>
      <h1 className="page-title">Account Recovery</h1>
      <p className="muted page-sub">
        Users who lost their registered number ask to move their account to a new one. The new number is verified by OTP — confirm the person before approving.
      </p>
      <Card
        actions={
          <Select
            value={status}
            onChange={(v) => setParams(v ? { status: v } : { status: '' }, { replace: true })}
            options={[
              { value: 'pending', label: 'Pending' },
              { value: 'approved', label: 'Approved' },
              { value: 'rejected', label: 'Rejected' },
            ]}
            placeholder="All"
          />
        }
      >
        <Loadable state={state}>
          {(rows) => (
            <>
              <Table
                rows={rows}
                empty="No requests."
                onRowClick={(r) => setReviewing(r)}
                columns={[
                  { key: 'when', header: 'Received', render: (r) => fmtDateTime(r.createdAt) },
                  { key: 'role', header: 'Role', render: (r) => ROLE_LABEL[r.role] },
                  { key: 'old', header: 'Old number', render: (r) => r.oldMobile },
                  { key: 'new', header: 'New number', render: (r) => r.newMobile },
                  {
                    key: 'acct',
                    header: 'Account found',
                    render: (r) => (r.account ? `${r.account.name || '—'}` : <span className="muted">No account for the old number</span>),
                  },
                  {
                    key: 'code',
                    header: 'Mio code',
                    render: (r) => (r.code ? <>{r.code} {r.codeMatches ? <Badge value="active" label="matches" /> : <Badge value="inactive" label="no match" />}</> : '—'),
                  },
                  { key: 'status', header: 'Status', render: (r) => <Badge value={r.status === 'approved' ? 'active' : r.status === 'rejected' ? 'inactive' : 'pending'} label={r.status} /> },
                ]}
              />
              <Pager meta={state.meta} page={page} onPage={(p) => setParams({ status, page: String(p) }, { replace: true })} />
            </>
          )}
        </Loadable>
      </Card>
      {reviewing && (
        <Review
          request={reviewing}
          onClose={() => setReviewing(null)}
          onDone={() => {
            setReviewing(null);
            state.reload();
          }}
        />
      )}
    </>
  );
}

function Review({ request: r, onClose, onDone }: { request: RecoveryRequest; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState('');
  const { run, busy } = useAction();
  const confirm = useConfirm();
  const pending = r.status === 'pending';

  async function decide(decision: 'approve' | 'reject') {
    if (decision === 'approve') {
      const ok = await confirm({
        title: 'Move this account?',
        tone: 'danger',
        confirmLabel: 'Approve',
        message: (
          <>
            <strong>{r.account?.name || 'This user'}</strong> will sign in with <strong>+91 {r.newMobile}</strong> from now on and is signed out on every device.
          </>
        ),
      });
      if (!ok) return;
    }
    const body = { decision, ...(note.trim() && { note: note.trim() }) };
    if (await run(() => api.patch(`/admin/recovery-requests/${r.id}`, body), decision === 'approve' ? 'Account moved to the new number' : 'Request rejected')) onDone();
  }

  return (
    <Modal
      title="Recovery request"
      onClose={onClose}
      footer={
        pending ? (
          <>
            <Button variant="ghost" busy={busy} onClick={() => decide('reject')}>
              Reject
            </Button>
            <Button variant="success" busy={busy} disabled={!r.account} onClick={() => decide('approve')}>
              Approve
            </Button>
          </>
        ) : (
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        )
      }
    >
      <div className="stack">
        <ul className="kv">
          <li>
            <span className="muted">Role</span>
            <span>{ROLE_LABEL[r.role]}</span>
          </li>
          <li>
            <span className="muted">Old → new number</span>
            <span>
              +91 {r.oldMobile} → +91 {r.newMobile} <Badge value="active" label="new number OTP-verified" />
            </span>
          </li>
          <li>
            <span className="muted">Account for old number</span>
            <span>{r.account ? `${r.account.name || '—'} (${r.account.status})` : 'None found — reject'}</span>
          </li>
          <li>
            <span className="muted">Mio code given</span>
            <span>{r.code ? `${r.code} · ${r.codeMatches ? 'matches the account' : 'does NOT match'}` : 'Not given'}</span>
          </li>
          <li>
            <span className="muted">Name given</span>
            <span>{r.name || '—'}</span>
          </li>
          {r.note && (
            <li>
              <span className="muted">Note</span>
              <span>{r.note}</span>
            </li>
          )}
          {!pending && (
            <li>
              <span className="muted">Reviewed</span>
              <span>
                {r.status} by {r.reviewedBy?.name ?? '—'} · {fmtDateTime(r.reviewedAt)}
                {r.adminNote ? ` · ${r.adminNote}` : ''}
              </span>
            </li>
          )}
        </ul>
        {pending && (
          <Field label="Note (saved with the decision)" hint="e.g. Verified by phone call with Dr. Sharma">
            <input maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        )}
      </div>
    </Modal>
  );
}
