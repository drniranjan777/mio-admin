import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { api } from '../api/client';
import { useConfirm } from '../components/ConfirmDialog';
import { Badge, Button, Card, Field, Loadable, Modal, Pager, Select, Table } from '../components/ui';
import { fmtDate, titleCase } from '../lib/format';
import type { Banner, BannerOptions, LocationRow } from '../lib/types';
import { useAction } from '../lib/useAction';
import { useApi } from '../lib/useApi';
import { useDebounced } from '../lib/useDebounced';

const STATUS_FILTERS = ['active', 'scheduled', 'expired', 'draft', 'inactive'] as const;
const SORTS = [
  { value: 'priority', label: 'Priority' },
  { value: 'newest', label: 'Newest first' },
  { value: 'start', label: 'Start date' },
  { value: 'title', label: 'Title A–Z' },
] as const;

export const STATUS_LABEL: Record<Banner['effectiveStatus'], string> = {
  active: 'Live',
  scheduled: 'Scheduled',
  expired: 'Expired',
  draft: 'Draft',
  inactive: 'Inactive',
};

export function targetLabel(b: Banner) {
  if (b.targeting === 'all') return 'All locations';
  return b.locations.map((l) => l.name).join(', ') || '—';
}

export function Banners() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'locations' ? 'locations' : 'banners';
  return (
    <>
      <div className="row between page-head">
        <h1 className="page-title">Banner Management</h1>
        {tab === 'banners' && (
          <Link to="/banners/new" className="btn btn-primary">
            + Add banner
          </Link>
        )}
      </div>
      <p className="muted page-sub">Banners appear on the doctor app home screen, matched to each doctor's registered state and city.</p>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'banners'} className={tab === 'banners' ? 'active' : ''} onClick={() => setParams({}, { replace: true })}>
          All banners
        </button>
        <button role="tab" aria-selected={tab === 'locations'} className={tab === 'locations' ? 'active' : ''} onClick={() => setParams({ tab: 'locations' }, { replace: true })}>
          Locations
        </button>
      </div>
      {tab === 'banners' ? <BannerList /> : <Locations />}
    </>
  );
}

// ---- Banner list -------------------------------------------------------------------------

function BannerList() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [q, setQ] = useState('');
  const query = useDebounced(q, 350);
  const [status, setStatus] = useState('');
  const [locationId, setLocationId] = useState('');
  const [sort, setSort] = useState('priority');
  const [page, setPage] = useState(1);
  const [viewing, setViewing] = useState<Banner | null>(null);
  const options = useApi(() => api.get<BannerOptions>('/admin/banners/options'), []);
  const state = useApi(() => api.get<Banner[]>('/admin/banners', { q: query, status, locationId, sort, page, limit: 15 }), [query, status, locationId, sort, page]);
  const { run, busy } = useAction();

  const refilter = (fn: () => void) => {
    fn();
    setPage(1);
  };

  async function toggle(b: Banner) {
    const next = b.status === 'active' ? 'inactive' : 'active';
    const ok = await confirm(
      next === 'inactive'
        ? { title: 'Deactivate banner?', tone: 'danger', confirmLabel: 'Deactivate', message: <><strong>{b.title}</strong> disappears from the doctor app on the next refresh.</> }
        : { title: 'Activate banner?', tone: 'success', confirmLabel: 'Activate', message: <><strong>{b.title}</strong> shows to doctors in {targetLabel(b)}{b.startDate ? ` from ${fmtDate(b.startDate)}` : ''}.</> },
    );
    if (ok && (await run(() => api.patch(`/admin/banners/${b.id}/status`, { status: next }), next === 'active' ? 'Banner activated' : 'Banner deactivated'))) state.reload();
  }

  async function remove(b: Banner) {
    const ok = await confirm({
      title: 'Delete banner?',
      tone: 'danger',
      confirmLabel: 'Delete',
      message: (
        <>
          <strong>{b.title}</strong> and its images are removed permanently. To hide it for now, deactivate it instead.
        </>
      ),
    });
    if (ok && (await run(() => api.delete(`/admin/banners/${b.id}`).then(() => true), 'Banner deleted')) === true) {
      setViewing(null);
      state.reload();
    }
  }

  const locationOptions = [
    { value: 'all', label: 'Targeted at all locations' },
    ...(options.data?.states ?? []).flatMap((s) => [{ value: s.id, label: s.name }, ...s.cities.map((c) => ({ value: c.id, label: `  ${c.name} (${s.name})` }))]),
  ];

  return (
    <Card
      actions={
        <>
          <input className="search" placeholder="Search title" value={q} onChange={(e) => refilter(() => setQ(e.target.value))} aria-label="Search banners" />
          <Select value={status} onChange={(v) => refilter(() => setStatus(v))} options={STATUS_FILTERS.map((s) => ({ value: s, label: STATUS_LABEL[s] }))} placeholder="All statuses" />
          <Select value={locationId} onChange={(v) => refilter(() => setLocationId(v))} options={locationOptions} placeholder="Any location" />
          <Select value={sort} onChange={(v) => refilter(() => setSort(v || 'priority'))} options={[...SORTS]} />
        </>
      }
    >
      <Loadable state={state}>
        {(rows) => (
          <>
            <Table
              rows={rows}
              onRowClick={setViewing}
              empty={
                <>
                  No banners match. <Link to="/banners/new">Create one</Link>.
                </>
              }
              columns={[
                {
                  key: 'banner',
                  header: 'Banner',
                  render: (b) => (
                    <div className="banner-cell">
                      {b.imageUrl && !b.imageMissing ? <img src={b.imageUrl} alt="" className="banner-thumb" loading="lazy" /> : <div className="banner-thumb missing">No image</div>}
                      <div>
                        <strong>{b.title}</strong>
                        {b.description && <div className="muted small clamp">{b.description}</div>}
                      </div>
                    </div>
                  ),
                },
                { key: 'loc', header: 'Locations', render: (b) => <span className="clamp">{targetLabel(b)}</span> },
                {
                  key: 'status',
                  header: 'Status',
                  render: (b) => (
                    <>
                      <Badge value={b.effectiveStatus} label={STATUS_LABEL[b.effectiveStatus]} />
                      {b.imageMissing && <div className="field-error small">Image missing</div>}
                    </>
                  ),
                },
                { key: 'start', header: 'Start date', render: (b) => (b.startDate ? fmtDate(b.startDate) : '—') },
                { key: 'end', header: 'End date', render: (b) => (b.endDate ? fmtDate(b.endDate) : '—') },
                { key: 'prio', header: 'Priority', width: '72px', render: (b) => b.priority },
                {
                  key: 'act',
                  header: 'Actions',
                  render: (b) => (
                    <div className="row gap row-actions" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="ghost" onClick={() => setViewing(b)}>
                        View
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => navigate(`/banners/${b.id}/edit`)}>
                        Edit
                      </Button>
                      <Button size="sm" variant={b.status === 'active' ? 'danger' : 'success'} busy={busy} onClick={() => toggle(b)}>
                        {b.status === 'active' ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button size="sm" variant="ghost" busy={busy} onClick={() => remove(b)} aria-label={`Delete ${b.title}`}>
                        🗑
                      </Button>
                    </div>
                  ),
                },
              ]}
            />
            <Pager meta={state.meta} page={page} onPage={setPage} />
          </>
        )}
      </Loadable>
      {viewing && <BannerView banner={viewing} targets={options.data?.internalTargets ?? []} onClose={() => setViewing(null)} onEdit={() => navigate(`/banners/${viewing.id}/edit`)} />}
    </Card>
  );
}

/** Read-only details + a preview at the app's banner shape. */
function BannerView({ banner: b, targets, onClose, onEdit }: { banner: Banner; targets: BannerOptions['internalTargets']; onClose: () => void; onEdit: () => void }) {
  const action =
    b.redirectType === 'none' ? 'No action' : b.redirectType === 'internal' ? `Opens app screen: ${targets.find((t) => t.key === b.redirectTarget)?.label ?? b.redirectTarget}` : `Opens link: ${b.redirectTarget}`;
  return (
    <Modal title="Banner details" onClose={onClose} wide footer={<Button onClick={onEdit}>Edit banner</Button>}>
      <div className="grid-2">
        <div>
          <BannerPreview banner={b} />
          {b.mobileImageUrl && (
            <p className="muted small">
              A separate mobile image is set. <a href={b.mobileImageUrl} target="_blank" rel="noreferrer">Open it</a>
            </p>
          )}
        </div>
        <ul className="kv">
          <li>
            <span className="muted">Status</span>
            <Badge value={b.effectiveStatus} label={STATUS_LABEL[b.effectiveStatus]} />
          </li>
          <li>
            <span className="muted">Shown to</span>
            <span>{targetLabel(b)}</span>
          </li>
          <li>
            <span className="muted">Targeting</span>
            <span>{titleCase(b.targeting)}</span>
          </li>
          <li>
            <span className="muted">Schedule</span>
            <span>
              {b.startDate ? fmtDate(b.startDate) : 'Now'} → {b.endDate ? fmtDate(b.endDate) : 'No end'}
            </span>
          </li>
          <li>
            <span className="muted">Priority</span>
            <span>{b.priority}</span>
          </li>
          <li>
            <span className="muted">On tap</span>
            <span className="clamp">{action}</span>
          </li>
          <li>
            <span className="muted">Last updated</span>
            <span>{fmtDate(b.updatedAt)}</span>
          </li>
        </ul>
      </div>
    </Modal>
  );
}

/** How the banner looks in the app (358:162 card, optional text overlay). */
export function BannerPreview({ banner }: { banner: Pick<Banner, 'title' | 'description' | 'imageUrl' | 'mobileImageUrl' | 'showText' | 'imageMissing'> }) {
  const src = banner.mobileImageUrl ?? banner.imageUrl;
  return (
    <div className="app-banner" aria-label="App preview">
      {src && !banner.imageMissing ? <img src={src} alt="" /> : <div className="app-banner-empty">Image preview</div>}
      {banner.showText && (
        <div className="app-banner-text">
          <strong>{banner.title || 'Banner title'}</strong>
          {banner.description && <span>{banner.description}</span>}
        </div>
      )}
    </div>
  );
}

// ---- Locations --------------------------------------------------------------------------

function Locations() {
  const [type, setType] = useState<'state' | 'city' | ''>('state');
  const [parentId, setParentId] = useState('');
  const [q, setQ] = useState('');
  const query = useDebounced(q, 300);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<LocationRow | 'new' | null>(null);
  const states = useApi(() => api.get<LocationRow[]>('/admin/locations', { type: 'state', limit: 100 }), []);
  const state = useApi(() => api.get<LocationRow[]>('/admin/locations', { type, parentId, q: query, page, limit: 50 }), [type, parentId, query, page]);

  return (
    <Card
      title="Locations"
      actions={
        <>
          <input className="search" placeholder="Search name or alias" value={q} onChange={(e) => (setQ(e.target.value), setPage(1))} aria-label="Search locations" />
          <Select
            value={type}
            onChange={(v) => (setType(v as typeof type), setPage(1))}
            options={[
              { value: 'state', label: 'States' },
              { value: 'city', label: 'Cities' },
            ]}
            placeholder="All types"
          />
          {type === 'city' && (
            <Select value={parentId} onChange={(v) => (setParentId(v), setPage(1))} options={(states.data ?? []).map((s) => ({ value: s.id, label: s.name }))} placeholder="Any state" />
          )}
          <Button onClick={() => setEditing('new')}>+ Add location</Button>
        </>
      }
    >
      <p className="muted small">
        Doctors are matched by the state and city in their profile. Add common spellings as aliases (e.g. Bangalore → Bengaluru). Deactivate a location to stop matching it; delete only works when nothing uses it.
      </p>
      <Loadable state={state}>
        {(rows) => (
          <>
            <Table
              rows={rows}
              onRowClick={setEditing}
              empty="No locations match."
              columns={[
                { key: 'name', header: 'Name', render: (l) => <strong>{l.name}</strong> },
                { key: 'type', header: 'Type', render: (l) => titleCase(l.type) },
                { key: 'parent', header: 'In', render: (l) => l.parentName ?? '—' },
                { key: 'aliases', header: 'Aliases', render: (l) => <span className="clamp">{l.aliases.join(', ') || '—'}</span> },
                { key: 'code', header: 'Code', render: (l) => l.code ?? '—' },
                { key: 'status', header: 'Status', render: (l) => <Badge value={l.status} /> },
              ]}
            />
            <Pager meta={state.meta} page={page} onPage={setPage} />
          </>
        )}
      </Loadable>
      {editing && (
        <LocationForm
          location={editing === 'new' ? null : editing}
          states={states.data ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            state.reload();
            states.reload();
          }}
        />
      )}
    </Card>
  );
}

function LocationForm({ location, states, onClose, onSaved }: { location: LocationRow | null; states: LocationRow[]; onClose: () => void; onSaved: () => void }) {
  const confirm = useConfirm();
  const [form, setForm] = useState({
    name: location?.name ?? '',
    type: location?.type ?? 'city',
    parentId: location?.parentId ?? '',
    code: location?.code ?? '',
    aliases: (location?.aliases ?? []).join(', '),
    status: location?.status ?? 'active',
  });
  const { run, busy, fields } = useAction();

  async function submit(e: FormEvent) {
    e.preventDefault();
    const aliases = form.aliases.split(',').map((a) => a.trim()).filter(Boolean);
    const body = { name: form.name.trim(), code: form.code.trim(), aliases, status: form.status };
    const ok = location
      ? await run(() => api.patch(`/admin/locations/${location.id}`, body), 'Location saved')
      : await run(() => api.post('/admin/locations', { ...body, type: form.type, parentId: form.type === 'city' ? form.parentId : undefined }), 'Location added');
    if (ok) onSaved();
  }

  async function remove() {
    if (!location) return;
    const ok = await confirm({ title: 'Delete location?', tone: 'danger', confirmLabel: 'Delete', message: <><strong>{location.name}</strong> is removed. Locations used by banners or with cities under them cannot be deleted — deactivate those instead.</> });
    if (ok && (await run(() => api.delete(`/admin/locations/${location.id}`).then(() => true), 'Location deleted')) === true) onSaved();
  }

  return (
    <Modal
      title={location ? `Edit ${location.name}` : 'Add location'}
      onClose={onClose}
      footer={
        <>
          {location && location.type !== 'country' && (
            <Button variant="danger" busy={busy} onClick={remove}>
              Delete
            </Button>
          )}
          <div className="spacer" />
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button form="loc-form" type="submit" busy={busy}>
            Save
          </Button>
        </>
      }
    >
      <form id="loc-form" className="stack" onSubmit={submit}>
        {!location && (
          <div className="form-grid">
            <Field label="Type">
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as 'state' | 'city' })}>
                <option value="city">City</option>
                <option value="state">State / UT</option>
              </select>
            </Field>
            {form.type === 'city' && (
              <Field label="State *" error={fields.parentId}>
                <select required value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })}>
                  <option value="">Choose state</option>
                  {states.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>
        )}
        <Field label="Name *" error={fields.name}>
          <input required minLength={2} maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Aliases" hint="Other spellings doctors may type, separated by commas" error={fields.aliases}>
          <input value={form.aliases} onChange={(e) => setForm({ ...form, aliases: e.target.value })} placeholder="e.g. Bangalore, Bengaluru Urban" />
        </Field>
        <div className="form-grid">
          <Field label="Code" hint="Optional, e.g. IN-TG" error={fields.code}>
            <input value={form.code} maxLength={20} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as 'active' | 'inactive' })}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </Field>
        </div>
      </form>
    </Modal>
  );
}
