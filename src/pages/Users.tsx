import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';

import { api } from '../api/client';
import { Badge, Button, Card, Field, Loadable, Modal, Pager, Select, Table } from '../components/ui';
import { fmtDate, fmtDateTime, ROLE_LABEL, titleCase } from '../lib/format';
import type { Role, UserDetail, UserRow } from '../lib/types';
import { useAction } from '../lib/useAction';
import { useApi } from '../lib/useApi';
import { useDebounced } from '../lib/useDebounced';
import { ImportDoctors } from './ImportDoctors';
import { useConfirm } from '../components/ConfirmDialog';

const ROLES = [
  { value: 'doctor' as const, label: 'Doctors' },
  { value: 'mr' as const, label: 'MRs' },
  { value: 'receptionist' as const, label: 'Receptionists' },
];

export function Users() {
  const [params, setParams] = useSearchParams();
  const role = (params.get('role') ?? '') as Role | '';
  const status = params.get('status') ?? '';
  const page = Number(params.get('page') ?? 1);
  const [q, setQ] = useState(params.get('q') ?? '');
  const query = useDebounced(q, 350);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);

  const set = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  };

  const state = useApi(() => api.get<UserRow[]>('/admin/users', { role, status, q: query, page, limit: 20 }), [role, status, query, page]);

  return (
    <>
      <h1 className="page-title">Users</h1>
      <Card
        actions={
          <>
            <input className="search" placeholder="Search name, mobile, email" value={q} onChange={(e) => setQ(e.target.value)} />
            <Select value={role} onChange={(v) => set({ role: v })} options={ROLES} placeholder="All roles" />
            <Select
              value={status}
              onChange={(v) => set({ status: v })}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
                { value: 'deleted', label: 'Deleted' },
              ]}
              placeholder="Active & inactive"
            />
            <Button variant="ghost" onClick={() => setImporting(true)}>
              ⬆ Import doctors (CSV)
            </Button>
            <Button onClick={() => setAdding(true)}>+ Add user</Button>
          </>
        }
      >
        <Loadable state={state}>
          {(rows) => (
            <>
              <Table
                rows={rows}
                onRowClick={(r) => setOpenId(r.id)}
                empty="No users match these filters."
                columns={[
                  { key: 'name', header: 'Name', render: (r) => <strong>{r.name || '—'}</strong> },
                  { key: 'role', header: 'Role', render: (r) => ROLE_LABEL[r.role] },
                  { key: 'code', header: 'Code', render: (r) => r.code ?? '—' },
                  { key: 'mobile', header: 'Mobile', render: (r) => r.mobile ?? '—' },
                  { key: 'detail', header: 'Specialty / Company', render: (r) => r.detail ?? '—' },
                  { key: 'onb', header: 'Registration', render: (r) => (r.onboarded ? 'Complete' : <span className="muted">Incomplete</span>) },
                  { key: 'status', header: 'Status', render: (r) => <Badge value={r.status} /> },
                  { key: 'joined', header: 'Joined', render: (r) => fmtDate(r.createdAt) },
                ]}
              />
              <Pager meta={state.meta} page={page} onPage={(p) => set({ page: String(p) })} />
            </>
          )}
        </Loadable>
      </Card>
      {importing && <ImportDoctors onClose={() => setImporting(false)} onImported={state.reload} />}
      {adding && (
        <AddUser
          onClose={() => setAdding(false)}
          onCreated={(id) => {
            setAdding(false);
            state.reload();
            setOpenId(id);
          }}
        />
      )}
      {openId && <UserDrawer id={openId} onClose={() => setOpenId(null)} onChanged={state.reload} />}
    </>
  );
}

const PROFILE_FIELDS: [string, string][] = [
  ['code', 'Code'],
  ['qualification', 'Qualification'],
  ['specialty', 'Specialty'],
  ['gender', 'Gender'],
  ['dateOfBirth', 'Date of birth'],
  ['email', 'Email'],
  ['councilRegNo', 'Council Reg. No'],
  ['availability', 'Availability'],
  ['employeeCode', 'Employee code'],
  ['division', 'Division'],
];

function UserDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const state = useApi(() => api.get<UserDetail>(`/admin/users/${id}`), [id]);
  const { run, busy } = useAction();
  const confirm = useConfirm();

  async function toggle(d: UserDetail) {
    const next = d.user.status === 'active' ? 'inactive' : 'active';
    const name = d.user.name || 'this user';
    const ok = await confirm(
      next === 'inactive'
        ? { title: `Deactivate ${ROLE_LABEL[d.user.role]}?`, tone: 'danger', confirmLabel: 'Deactivate', message: <><strong>{name}</strong> is signed out on every device and cannot use the app until reactivated.</> }
        : { title: `Activate ${ROLE_LABEL[d.user.role]}?`, tone: 'success', confirmLabel: 'Activate', message: <><strong>{name}</strong> can sign in again with OTP.</> },
    );
    if (!ok) return;
    const saved = await run(() => api.patch(`/admin/users/${id}/status`, { status: next }), next === 'active' ? 'User activated' : 'User deactivated');
    if (saved) {
      state.reload();
      onChanged();
    }
  }

  return (
    <Modal title="User details" onClose={onClose} wide>
      <Loadable state={state}>
        {(d) => {
          const p = (d.profile ?? {}) as Record<string, unknown>;
          const practice = (p.practice ?? {}) as Record<string, string>;
          const company = (p.company ?? {}) as Record<string, string>;
          return (
            <div className="stack">
              <div className="row between">
                <div>
                  <h3 className="m0">{d.user.name || '—'}</h3>
                  <span className="muted">
                    {ROLE_LABEL[d.user.role]} · {d.user.mobile ?? d.user.email} · joined {fmtDate(d.user.createdAt)} · last login {fmtDateTime(d.user.lastLoginAt)}
                  </span>
                </div>
                <div className="row gap">
                  <Badge value={d.user.status} />
                  {d.user.status !== 'deleted' && (
                    <Button variant={d.user.status === 'active' ? 'danger' : 'success'} size="sm" busy={busy} onClick={() => toggle(d)}>
                      {d.user.status === 'active' ? 'Deactivate' : 'Activate'}
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid-2">
                <div>
                  <h4>Profile</h4>
                  <ul className="kv">
                    {PROFILE_FIELDS.filter(([k]) => p[k] !== undefined && p[k] !== '').map(([k, label]) => (
                      <li key={k}>
                        <span className="muted">{label}</span>
                        <span>{String(p[k])}</span>
                      </li>
                    ))}
                    {practice.clinicName && (
                      <li>
                        <span className="muted">Practice</span>
                        <span>
                          {practice.clinicName}, {practice.city}
                        </span>
                      </li>
                    )}
                    {company.name && (
                      <li>
                        <span className="muted">Company</span>
                        <span>{company.name}</span>
                      </li>
                    )}
                  </ul>
                </div>
                <div>
                  <h4>Activity</h4>
                  <ul className="kv">
                    <li>
                      <span className="muted">Subscription</span>
                      <span>{d.subscription ? `${d.subscription.plan.name} · ${d.subscription.endsAt ? `till ${fmtDate(d.subscription.endsAt)}` : 'lifetime'}` : 'None'}</span>
                    </li>
                    {Object.entries(d.appointments).map(([s, n]) => (
                      <li key={s}>
                        <span className="muted">{titleCase(s)} appointments</span>
                        <span>{n}</span>
                      </li>
                    ))}
                  </ul>
                  {d.access.length > 0 && (
                    <>
                      <h4>{d.user.role === 'doctor' ? 'Receptionists' : 'Doctors'}</h4>
                      <ul className="kv">
                        {d.access.map((a) => (
                          <li key={a.id}>
                            <span>{a.with?.name ?? '—'}</span>
                            <span>
                              <Badge value={a.status} /> <span className="muted">{a.permissions.join(', ')}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        }}
      </Loadable>
    </Modal>
  );
}

const RECEPTION_PERMS = ['book', 'reschedule', 'cancel'] as const;

/** Pre-registers an app user; they sign in with OTP on this mobile and finish registration. */
function AddUser({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [role, setRole] = useState<Role>('doctor');
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [doctorIds, setDoctorIds] = useState<Set<string>>(new Set());
  const [perms, setPerms] = useState<Set<string>>(new Set(['book']));
  const [doctorQuery, setDoctorQuery] = useState('');
  const q = useDebounced(doctorQuery, 300);
  const doctors = useApi(
    () => (role === 'receptionist' ? api.get<UserRow[]>('/admin/users', { role: 'doctor', status: 'active', q, limit: 50 }) : Promise.resolve({ data: [] as UserRow[] })),
    [role, q],
  );
  const { run, busy, fields } = useAction();

  const flip = <T,>(set: Set<T>, v: T) => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    return next;
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    const body = {
      role,
      name: name.trim(),
      mobile: mobile.trim(),
      ...(role === 'receptionist' && { doctorIds: [...doctorIds], permissions: [...perms] }),
    };
    const res = await run(() => api.post<UserDetail>('/admin/users', body), `${ROLE_LABEL[role]} created — they can now sign in with OTP`);
    if (res) onCreated(res.data.user.id);
  }

  return (
    <Modal
      title="Add user"
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button form="add-user" type="submit" busy={busy} disabled={role === 'receptionist' && doctorIds.size === 0}>
            Create
          </Button>
        </>
      }
    >
      <form id="add-user" className="stack" onSubmit={submit}>
        <div className="form-grid">
          <Field label="Role *" error={fields.role}>
            <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="doctor">Doctor</option>
              <option value="mr">MR</option>
              <option value="receptionist">Receptionist</option>
            </select>
          </Field>
          <Field label="Full name *" error={fields.name}>
            <input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Mobile number *" hint="10-digit Indian mobile — used for OTP sign-in" error={fields.mobile}>
            <input required inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength={10} value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))} />
          </Field>
        </div>
        {role === 'receptionist' && (
          <>
            <Field label={`Doctors this receptionist works for * (${doctorIds.size} selected)`} error={fields.doctorIds}>
              <input placeholder="Search doctors…" value={doctorQuery} onChange={(e) => setDoctorQuery(e.target.value)} />
            </Field>
            <Loadable state={doctors}>
              {(list) =>
                list.length ? (
                  <div className="perm-grid">
                    {list.map((d) => (
                      <label key={d.id} className={`perm ${doctorIds.has(d.id) ? 'on' : ''}`}>
                        <input type="checkbox" checked={doctorIds.has(d.id)} onChange={() => setDoctorIds((s) => flip(s, d.id))} />
                        <span>
                          <strong>{d.name}</strong>
                          <span className="muted small">
                            {d.code} · {d.detail ?? ''}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="muted small">No active doctors found.</p>
                )
              }
            </Loadable>
            <Field label="Permissions for these doctors" hint="View is always included">
              <div className="chips">
                <span className="chip on">view</span>
                {RECEPTION_PERMS.map((p) => (
                  <label key={p} className={`chip ${perms.has(p) ? 'on' : ''}`}>
                    <input type="checkbox" checked={perms.has(p)} onChange={() => setPerms((s) => flip(s, p))} />
                    {p}
                  </label>
                ))}
              </div>
            </Field>
          </>
        )}
      </form>
    </Modal>
  );
}
