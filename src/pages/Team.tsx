import { useState, type FormEvent } from 'react';

import { api } from '../api/client';
import { Badge, Button, Card, Field, Loadable, Modal, Table } from '../components/ui';
import { fmtDateTime, titleCase } from '../lib/format';
import type { AdminRoleRow, Permission, StaffRow } from '../lib/types';
import { useAction } from '../lib/useAction';
import { useApi } from '../lib/useApi';
import { useConfirm } from '../components/ConfirmDialog';

const PERMISSION_HELP: Record<Permission, string> = {
  dashboard: 'Dashboard numbers',
  users: 'View, create, activate/deactivate app users',
  access: 'Receptionist ↔ doctor access',
  appointments: 'View and act on appointments',
  conferences: 'Create and edit conferences',
  banners: 'Location-based home banners and locations',
  billing: 'Plans, payments, subscriptions',
  tickets: 'Help desk requests (can be assigned tasks)',
  faqs: 'FAQ content',
  content: 'Terms & policies',
  settings: 'Help desk contacts and topics',
  reports: 'Run and export reports (Excel/CSV)',
  audit: 'Read the audit log',
};

type Tab = 'team' | 'roles';

export function Team() {
  const [tab, setTab] = useState<Tab>('team');
  const roles = useApi(() => api.get<{ roles: AdminRoleRow[]; permissions: Permission[] }>('/admin/roles'), []);
  return (
    <>
      <h1 className="page-title">Admin Team & Roles</h1>
      <p className="muted page-sub">
        Give each team member a role; a role decides which sections they can open. Only Super Admins see this page.
      </p>
      <div className="tabs" role="tablist">
        {(['team', 'roles'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {t === 'team' ? 'Team members' : 'Roles'}
          </button>
        ))}
      </div>
      <Loadable state={roles}>
        {(r) => (tab === 'team' ? <Staff roles={r.roles} onChanged={roles.reload} /> : <Roles roles={r.roles} permissions={r.permissions} onChanged={roles.reload} />)}
      </Loadable>
    </>
  );
}

// ---- Team members ------------------------------------------------------------------------

function Staff({ roles, onChanged }: { roles: AdminRoleRow[]; onChanged: () => void }) {
  const state = useApi(() => api.get<StaffRow[]>('/admin/staff'), []);
  const [editing, setEditing] = useState<StaffRow | 'new' | null>(null);
  const [secret, setSecret] = useState<{ email: string; password: string } | null>(null);
  const { run, busy } = useAction();
  const confirm = useConfirm();

  const refresh = () => {
    state.reload();
    onChanged();
  };

  async function resetPassword(s: StaffRow) {
    const ok = await confirm({
      title: 'Reset password?',
      tone: 'warning',
      confirmLabel: 'Reset password',
      message: (
        <>
          <strong>{s.name}</strong> is signed out everywhere and gets a new temporary password, which they must change at next sign-in.
        </>
      ),
    });
    if (!ok) return;
    const res = await run(() => api.post<{ temporaryPassword: string }>(`/admin/staff/${s.id}/reset-password`), 'Password reset');
    if (res) {
      setSecret({ email: s.email, password: res.data.temporaryPassword });
      state.reload();
    }
  }

  async function toggle(s: StaffRow) {
    const status = s.status === 'active' ? 'inactive' : 'active';
    const ok = await confirm(
      status === 'inactive'
        ? { title: 'Deactivate team member?', tone: 'danger', confirmLabel: 'Deactivate', message: <><strong>{s.name}</strong> is signed out immediately and can no longer open the admin panel.</> }
        : { title: 'Activate team member?', tone: 'success', confirmLabel: 'Activate', message: <><strong>{s.name}</strong> can sign in again with their current password.</> },
    );
    if (!ok) return;
    if (await run(() => api.patch(`/admin/staff/${s.id}`, { status }), status === 'active' ? 'Activated' : 'Deactivated')) refresh();
  }

  return (
    <Card title="Team members" actions={<Button onClick={() => setEditing('new')}>+ Add team member</Button>}>
      <Loadable state={state}>
        {(rows) => (
          <Table
            rows={rows}
            columns={[
              {
                key: 'name',
                header: 'Name',
                render: (s) => (
                  <>
                    <strong>{s.name}</strong> {s.isSelf && <span className="muted small">(you)</span>}
                    <div className="muted small">{s.email}</div>
                  </>
                ),
              },
              { key: 'role', header: 'Role', render: (s) => <Badge value={s.role.isSuper ? 'active' : 'completed'} label={s.role.name} /> },
              { key: 'sections', header: 'Sections', render: (s) => <span className="clamp">{s.role.isSuper ? 'Everything' : s.permissions.map(titleCase).join(', ')}</span> },
              { key: 'status', header: 'Status', render: (s) => (s.mustChangePassword ? <Badge value="pending" label="Awaiting first sign-in" /> : <Badge value={s.status} />) },
              { key: 'last', header: 'Last sign-in', render: (s) => fmtDateTime(s.lastLoginAt) },
              {
                key: 'act',
                header: '',
                render: (s) =>
                  s.isSelf ? null : (
                    <div className="row gap">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(s)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" busy={busy} onClick={() => resetPassword(s)}>
                        Reset password
                      </Button>
                      <Button size="sm" variant={s.status === 'active' ? 'danger' : 'success'} busy={busy} onClick={() => toggle(s)}>
                        {s.status === 'active' ? 'Deactivate' : 'Activate'}
                      </Button>
                    </div>
                  ),
              },
            ]}
          />
        )}
      </Loadable>
      {editing && (
        <StaffForm
          staff={editing === 'new' ? null : editing}
          roles={roles}
          onClose={() => setEditing(null)}
          onSaved={(created) => {
            setEditing(null);
            if (created) setSecret(created);
            refresh();
          }}
        />
      )}
      {secret && <TemporaryPassword {...secret} onClose={() => setSecret(null)} />}
    </Card>
  );
}

function StaffForm({
  staff,
  roles,
  onClose,
  onSaved,
}: {
  staff: StaffRow | null;
  roles: AdminRoleRow[];
  onClose: () => void;
  onSaved: (created?: { email: string; password: string }) => void;
}) {
  const [name, setName] = useState(staff?.name ?? '');
  const [email, setEmail] = useState(staff?.email ?? '');
  const [roleId, setRoleId] = useState(staff?.role.id ?? roles.find((r) => !r.isSuper)?.id ?? '');
  const { run, busy, fields } = useAction();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (staff) {
      const body = { name: name.trim(), ...(roleId && roleId !== staff.role.id && { roleId }) };
      if (await run(() => api.patch(`/admin/staff/${staff.id}`, body), 'Team member updated')) onSaved();
    } else {
      const res = await run(() => api.post<{ temporaryPassword: string }>('/admin/staff', { name: name.trim(), email: email.trim(), roleId }), 'Team member added');
      if (res) onSaved({ email: email.trim(), password: res.data.temporaryPassword });
    }
  }

  const chosen = roles.find((r) => r.id === roleId);
  return (
    <Modal
      title={staff ? `Edit ${staff.name}` : 'Add team member'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button form="staff-form" type="submit" busy={busy}>
            {staff ? 'Save' : 'Create'}
          </Button>
        </>
      }
    >
      <form id="staff-form" className="stack" onSubmit={submit}>
        <Field label="Full name *" error={fields.name}>
          <input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Email (sign-in) *" error={fields.email}>
          <input type="email" required disabled={Boolean(staff)} value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Role *" error={fields.roleId}>
          <select required value={roleId} onChange={(e) => setRoleId(e.target.value)}>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </Field>
        {chosen && <p className="muted small m0">Can open: {chosen.isSuper ? 'everything, including this page' : chosen.permissions.map(titleCase).join(', ')}</p>}
        {!staff && <p className="muted small m0">A temporary password is generated; they must choose their own at first sign-in.</p>}
      </form>
    </Modal>
  );
}

function TemporaryPassword({ email, password, onClose }: { email: string; password: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <Modal title="Temporary password" onClose={onClose} footer={<Button onClick={onClose}>Done</Button>}>
      <div className="stack">
        <p className="m0">
          Share this with <strong>{email}</strong> through a secure channel. It is shown <strong>only once</strong> and must be changed at first sign-in.
        </p>
        <div className="row gap">
          <code className="secret">{password}</code>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await navigator.clipboard.writeText(password);
              setCopied(true);
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ---- Roles -------------------------------------------------------------------------------

function Roles({ roles, permissions, onChanged }: { roles: AdminRoleRow[]; permissions: Permission[]; onChanged: () => void }) {
  const [editing, setEditing] = useState<AdminRoleRow | 'new' | null>(null);
  return (
    <Card title="Roles" actions={<Button onClick={() => setEditing('new')}>+ New role</Button>}>
      <Table
        rows={roles}
        onRowClick={(r) => !r.isSystem && setEditing(r)}
        columns={[
          {
            key: 'name',
            header: 'Role',
            render: (r) => (
              <>
                <strong>{r.name}</strong> {r.isSystem && <span className="muted small">(built-in)</span>}
                <div className="muted small">{r.description}</div>
              </>
            ),
          },
          { key: 'perms', header: 'Sections', render: (r) => <span className="clamp">{r.isSuper ? 'Everything + admin team' : r.permissions.map(titleCase).join(', ')}</span> },
          { key: 'members', header: 'Members', render: (r) => r.members },
        ]}
      />
      {editing && (
        <RoleForm
          role={editing === 'new' ? null : editing}
          permissions={permissions}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChanged();
          }}
        />
      )}
    </Card>
  );
}

function RoleForm({ role, permissions, onClose, onSaved }: { role: AdminRoleRow | null; permissions: Permission[]; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [perms, setPerms] = useState<Set<Permission>>(new Set(role?.permissions ?? ['dashboard']));
  const { run, busy, fields } = useAction();
  const confirm = useConfirm();

  const toggle = (p: Permission) =>
    setPerms((s) => {
      const next = new Set(s);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });

  async function submit(e: FormEvent) {
    e.preventDefault();
    const body = { name: name.trim(), description: description.trim(), permissions: permissions.filter((p) => perms.has(p)) };
    const ok = role ? await run(() => api.patch(`/admin/roles/${role.id}`, body), 'Role saved — applies immediately') : await run(() => api.post('/admin/roles', body), 'Role created');
    if (ok) onSaved();
  }

  async function remove() {
    if (!role) return;
    const ok = await confirm({
      title: 'Delete role?',
      tone: 'danger',
      confirmLabel: 'Delete role',
      message: (
        <>
          The role <strong>{role.name}</strong> will be removed. Roles still assigned to someone cannot be deleted.
        </>
      ),
    });
    if (!ok) return;
    if ((await run(() => api.delete(`/admin/roles/${role.id}`).then(() => true), 'Role deleted')) === true) onSaved();
  }

  return (
    <Modal
      title={role ? `Edit role · ${role.name}` : 'New role'}
      onClose={onClose}
      wide
      footer={
        <>
          {role && (
            <Button variant="danger" busy={busy} onClick={remove}>
              Delete
            </Button>
          )}
          <div className="spacer" />
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button form="role-form" type="submit" busy={busy}>
            Save
          </Button>
        </>
      }
    >
      <form id="role-form" className="stack" onSubmit={submit}>
        <div className="form-grid">
          <Field label="Role name *" error={fields.name}>
            <input required minLength={2} maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Description" error={fields.description}>
            <input maxLength={200} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </div>
        <Field label="Sections this role can open" error={fields.permissions}>
          <div className="perm-grid">
            {permissions.map((p) => (
              <label key={p} className={`perm ${perms.has(p) ? 'on' : ''}`}>
                <input type="checkbox" checked={perms.has(p)} onChange={() => toggle(p)} />
                <span>
                  <strong>{titleCase(p)}</strong>
                  <span className="muted small">{PERMISSION_HELP[p]}</span>
                </span>
              </label>
            ))}
          </div>
        </Field>
        {role && role.members > 0 && <p className="muted small m0">Changes apply to {role.members} member(s) on their next action.</p>}
      </form>
    </Modal>
  );
}
