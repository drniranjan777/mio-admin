import { useState, type FormEvent } from 'react';

import { api } from '../api/client';
import { Badge, Button, Card, Field, Loadable, Modal, Pager, Select, Table } from '../components/ui';
import { fmtDate } from '../lib/format';
import type { Conference } from '../lib/types';
import { useAction } from '../lib/useAction';
import { useApi } from '../lib/useApi';

type When = 'upcoming' | 'past' | 'all';

export function Conferences() {
  const [when, setWhen] = useState<When>('upcoming');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Conference | 'new' | null>(null);
  const state = useApi(() => api.get<Conference[]>('/conferences', { when, page, limit: 20 }), [when, page]);

  return (
    <>
      <h1 className="page-title">Conferences</h1>
      <Card
        actions={
          <>
            <Select
              value={when}
              onChange={(v) => {
                setWhen((v || 'all') as When);
                setPage(1);
              }}
              options={[
                { value: 'upcoming', label: 'Upcoming' },
                { value: 'past', label: 'Past' },
                { value: 'all', label: 'All' },
              ]}
            />
            <Button onClick={() => setEditing('new')}>+ New conference</Button>
          </>
        }
      >
        <Loadable state={state}>
          {(rows) => (
            <>
              <Table
                rows={rows}
                onRowClick={(c) => setEditing(c)}
                empty="No conferences."
                columns={[
                  { key: 'title', header: 'Title', render: (c) => <strong>{c.title}</strong> },
                  { key: 'dates', header: 'Dates', render: (c) => `${fmtDate(c.startDate)} – ${fmtDate(c.endDate)}` },
                  { key: 'where', header: 'Venue', render: (c) => [c.venue, c.city].filter(Boolean).join(', ') || '—' },
                  { key: 'spec', header: 'Specialty', render: (c) => c.specialty ?? 'All' },
                  { key: 'status', header: 'Status', render: (c) => <Badge value={c.status} /> },
                  {
                    key: 'part',
                    header: 'Planning / Registered / Info',
                    render: (c) => (c.participants ? `${c.participants.planning} / ${c.participants.registered} / ${c.participants.more_info}` : '—'),
                  },
                ]}
              />
              <Pager meta={state.meta} page={page} onPage={setPage} />
            </>
          )}
        </Loadable>
      </Card>
      {editing && (
        <ConferenceForm
          conference={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            state.reload();
          }}
        />
      )}
    </>
  );
}

const EMPTY = { title: '', organizer: '', startDate: '', endDate: '', venue: '', city: '', specialty: '', logoUrl: '', website: '', description: '', status: 'published' };

function ConferenceForm({ conference, onClose, onSaved }: { conference: Conference | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState(() => ({ ...EMPTY, ...Object.fromEntries(Object.entries(conference ?? {}).filter(([, v]) => typeof v === 'string')) }));
  const { run, busy, fields } = useAction();
  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    // Empty optional fields are left out rather than sent as "".
    // Demo rows use bundled app logos ("assets/…"); those are kept, not re-sent.
    const body = Object.fromEntries(
      Object.entries(form).filter(([k, v]) => k in EMPTY && v !== '' && !(k === 'logoUrl' && v.startsWith('assets/'))),
    );
    const ok = conference
      ? await run(() => api.patch(`/conferences/${conference.id}`, body), 'Conference updated')
      : await run(() => api.post('/conferences', body), form.status === 'published' ? 'Conference published — matching doctors notified' : 'Draft saved');
    if (ok) onSaved();
  }

  return (
    <Modal
      title={conference ? 'Edit conference' : 'New conference'}
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button form="conf-form" type="submit" busy={busy}>
            Save
          </Button>
        </>
      }
    >
      <form id="conf-form" className="form-grid" onSubmit={submit}>
        <Field label="Title *" error={fields.title}>
          <input required value={form.title} onChange={set('title')} />
        </Field>
        <Field label="Organizer" error={fields.organizer}>
          <input value={form.organizer} onChange={set('organizer')} />
        </Field>
        <Field label="Start date *" error={fields.startDate}>
          <input type="date" required value={form.startDate} onChange={set('startDate')} />
        </Field>
        <Field label="End date *" error={fields.endDate}>
          <input type="date" required value={form.endDate} onChange={set('endDate')} />
        </Field>
        <Field label="Venue" error={fields.venue}>
          <input value={form.venue} onChange={set('venue')} />
        </Field>
        <Field label="City" error={fields.city}>
          <input value={form.city} onChange={set('city')} />
        </Field>
        <Field label="Specialty" hint="Doctors of this specialty are notified. Leave empty for all." error={fields.specialty}>
          <input value={form.specialty} onChange={set('specialty')} />
        </Field>
        <Field label="Status" error={fields.status}>
          <select value={form.status} onChange={set('status')}>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </Field>
        <Field label="Logo URL" hint="https:// link" error={fields.logoUrl}>
          <input type="url" value={form.logoUrl.startsWith('assets/') ? '' : form.logoUrl} placeholder={form.logoUrl.startsWith('assets/') ? 'Using built-in demo logo' : ''} onChange={set('logoUrl')} />
        </Field>
        <Field label="Website" hint="https:// link" error={fields.website}>
          <input type="url" value={form.website} onChange={set('website')} />
        </Field>
        <Field label="Description" error={fields.description}>
          <textarea rows={3} value={form.description} onChange={set('description')} />
        </Field>
      </form>
    </Modal>
  );
}
