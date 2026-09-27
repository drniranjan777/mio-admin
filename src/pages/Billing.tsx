import { useState, type FormEvent } from 'react';

import { api } from '../api/client';
import { Badge, Button, Card, Field, Loadable, Modal, Pager, Select, Table } from '../components/ui';
import { fmtDate, fmtDateTime, ROLE_LABEL, rupees, titleCase } from '../lib/format';
import type { Order, Plan, SubscriptionRow } from '../lib/types';
import { useAction } from '../lib/useAction';
import { useApi } from '../lib/useApi';

type Tab = 'plans' | 'orders' | 'subscriptions';

export function Billing() {
  const [tab, setTab] = useState<Tab>('plans');
  return (
    <>
      <h1 className="page-title">Plans & Billing</h1>
      <div className="tabs" role="tablist">
        {(['plans', 'orders', 'subscriptions'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {titleCase(t)}
          </button>
        ))}
      </div>
      {tab === 'plans' && <Plans />}
      {tab === 'orders' && <Orders />}
      {tab === 'subscriptions' && <Subscriptions />}
    </>
  );
}

function Plans() {
  const state = useApi(() => api.get<Plan[]>('/admin/plans'), []);
  const [editing, setEditing] = useState<Plan | 'new' | null>(null);
  return (
    <Card title="Plans" actions={<Button onClick={() => setEditing('new')}>+ New plan</Button>}>
      <p className="muted small">Prices include GST. Changing a price affects new orders only — existing subscriptions keep what was paid.</p>
      <Loadable state={state}>
        {(rows) => (
          <Table
            rows={rows}
            onRowClick={(p) => setEditing(p)}
            columns={[
              { key: 'name', header: 'Plan', render: (p) => <strong>{p.name}</strong> },
              { key: 'code', header: 'Code', render: (p) => <code>{p.code}</code> },
              { key: 'role', header: 'For', render: (p) => ROLE_LABEL[p.role] },
              { key: 'period', header: 'Period', render: (p) => titleCase(p.period) },
              { key: 'price', header: 'Price', render: (p) => rupees(p.pricePaise) },
              { key: 'mrp', header: 'Struck price', render: (p) => (p.mrpPaise === null ? '—' : rupees(p.mrpPaise)) },
              { key: 'subs', header: 'Active subscribers', render: (p) => p.activeSubscribers },
              { key: 'active', header: 'Status', render: (p) => <Badge value={p.active ? 'active' : 'inactive'} /> },
            ]}
          />
        )}
      </Loadable>
      {editing && (
        <PlanForm
          plan={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            state.reload();
          }}
        />
      )}
    </Card>
  );
}

function PlanForm({ plan, onClose, onSaved }: { plan: Plan | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    code: plan?.code ?? '',
    role: plan?.role ?? 'mr',
    name: plan?.name ?? '',
    period: plan?.period ?? 'monthly',
    price: plan ? String(plan.pricePaise / 100) : '',
    mrp: plan?.mrpPaise != null ? String(plan.mrpPaise / 100) : '',
    taxPercent: String(plan?.taxPercent ?? 18),
    features: (plan?.features ?? []).join('\n'),
    active: plan?.active ?? true,
    sort: String(plan?.sort ?? 0),
  });
  const { run, busy, fields } = useAction();
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const toPaise = (v: string) => Math.round(Number(v) * 100);
    const body = {
      code: form.code.trim(),
      role: form.role,
      name: form.name.trim(),
      period: form.period,
      pricePaise: toPaise(form.price),
      ...(form.mrp !== '' && { mrpPaise: toPaise(form.mrp) }),
      taxPercent: Number(form.taxPercent),
      features: form.features.split('\n').map((f) => f.trim()).filter(Boolean),
      active: form.active,
      sort: Number(form.sort) || 0,
    };
    if (await run(() => api.put('/plans', body), 'Plan saved')) onSaved();
  }

  return (
    <Modal
      title={plan ? `Edit plan · ${plan.code}` : 'New plan'}
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button form="plan-form" type="submit" busy={busy}>
            Save
          </Button>
        </>
      }
    >
      <form id="plan-form" className="form-grid" onSubmit={submit}>
        <Field label="Code *" hint="lowercase, e.g. mr-yearly (cannot be changed later)" error={fields.code}>
          <input required pattern="[a-z0-9-]{2,40}" value={form.code} disabled={Boolean(plan)} onChange={set('code')} />
        </Field>
        <Field label="Name *" error={fields.name}>
          <input required value={form.name} onChange={set('name')} />
        </Field>
        <Field label="For role" error={fields.role}>
          <select value={form.role} onChange={set('role')}>
            <option value="mr">MR</option>
            <option value="doctor">Doctor</option>
            <option value="receptionist">Receptionist</option>
          </select>
        </Field>
        <Field label="Period" error={fields.period}>
          <select value={form.period} onChange={set('period')}>
            <option value="monthly">Monthly (30 days)</option>
            <option value="yearly">Yearly (365 days)</option>
            <option value="lifetime">Lifetime</option>
          </select>
        </Field>
        <Field label="Price ₹ (incl. GST) *" error={fields.pricePaise}>
          <input required type="number" min="0" step="0.01" value={form.price} onChange={set('price')} />
        </Field>
        <Field label="Struck price ₹" error={fields.mrpPaise}>
          <input type="number" min="0" step="0.01" value={form.mrp} onChange={set('mrp')} />
        </Field>
        <Field label="GST %" error={fields.taxPercent}>
          <input type="number" min="0" max="50" step="0.5" value={form.taxPercent} onChange={set('taxPercent')} />
        </Field>
        <Field label="Sort order" error={fields.sort}>
          <input type="number" value={form.sort} onChange={set('sort')} />
        </Field>
        <Field label="Features (one per line)" error={fields.features}>
          <textarea rows={4} value={form.features} onChange={set('features')} />
        </Field>
        <label className="check">
          <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} /> Available for purchase
        </label>
      </form>
    </Modal>
  );
}

function Orders() {
  const [status, setStatus] = useState<Order['status'] | ''>('');
  const [page, setPage] = useState(1);
  const state = useApi(() => api.get<Order[]>('/admin/orders', { status, page, limit: 25 }), [status, page]);
  return (
    <Card
      title="Payment orders"
      actions={
        <Select
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          options={(['paid', 'created', 'failed', 'expired'] as const).map((s) => ({ value: s, label: titleCase(s) }))}
          placeholder="All statuses"
        />
      }
    >
      <Loadable state={state}>
        {(rows) => (
          <>
            <Table
              rows={rows}
              empty="No orders yet."
              columns={[
                { key: 'no', header: 'Order', render: (o) => <code>{o.number}</code> },
                { key: 'user', header: 'User', render: (o) => `${o.user?.name || '—'} (${ROLE_LABEL[o.user?.role ?? ''] ?? '—'})` },
                { key: 'plan', header: 'Plan', render: (o) => o.plan?.name ?? '—' },
                { key: 'amt', header: 'Amount', render: (o) => rupees(o.amountPaise) },
                { key: 'method', header: 'Method', render: (o) => `${o.method} · ${o.provider}` },
                { key: 'status', header: 'Status', render: (o) => <Badge value={o.status} label={o.failureReason ? `Failed: ${o.failureReason}` : undefined} /> },
                { key: 'at', header: 'Created', render: (o) => fmtDateTime(o.createdAt) },
              ]}
            />
            <Pager meta={state.meta} page={page} onPage={setPage} />
          </>
        )}
      </Loadable>
    </Card>
  );
}

function Subscriptions() {
  const [stateFilter, setStateFilter] = useState<'active' | 'expired' | ''>('active');
  const [page, setPage] = useState(1);
  const state = useApi(() => api.get<SubscriptionRow[]>('/admin/subscriptions', { state: stateFilter || 'all', page, limit: 25 }), [stateFilter, page]);
  return (
    <Card
      title="Subscriptions"
      actions={
        <Select
          value={stateFilter}
          onChange={(v) => {
            setStateFilter(v);
            setPage(1);
          }}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'expired', label: 'Expired' },
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
              empty="No subscriptions."
              columns={[
                { key: 'user', header: 'User', render: (s) => s.user?.name || '—' },
                { key: 'role', header: 'Role', render: (s) => ROLE_LABEL[s.user?.role ?? ''] ?? '—' },
                { key: 'plan', header: 'Plan', render: (s) => s.plan.name },
                { key: 'start', header: 'Started', render: (s) => fmtDate(s.startsAt) },
                { key: 'end', header: 'Ends', render: (s) => (s.endsAt ? fmtDate(s.endsAt) : 'Lifetime') },
                { key: 'st', header: 'Status', render: (s) => <Badge value={s.active ? 'active' : 'expired'} /> },
              ]}
            />
            <Pager meta={state.meta} page={page} onPage={setPage} />
          </>
        )}
      </Loadable>
    </Card>
  );
}
