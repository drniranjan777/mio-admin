import { useState, type FormEvent } from 'react';

import { api } from '../api/client';
import { Badge, Button, Card, Field, Loadable, Modal, Table } from '../components/ui';
import { ROLE_LABEL } from '../lib/format';
import type { Faq } from '../lib/types';
import { useAction } from '../lib/useAction';
import { useApi } from '../lib/useApi';
import { useConfirm } from '../components/ConfirmDialog';

export function Faqs() {
  const state = useApi(() => api.get<Faq[]>('/admin/faqs'), []);
  const [editing, setEditing] = useState<Faq | 'new' | null>(null);

  return (
    <>
      <h1 className="page-title">FAQs</h1>
      <Card actions={<Button onClick={() => setEditing('new')}>+ New FAQ</Button>}>
        <Loadable state={state}>
          {(rows) => (
            <Table
              rows={rows}
              onRowClick={(f) => setEditing(f)}
              empty="No FAQs yet."
              columns={[
                { key: 'sort', header: '#', width: '48px', render: (f) => f.sort },
                { key: 'q', header: 'Question', render: (f) => <strong>{f.question}</strong> },
                { key: 'a', header: 'Answer', render: (f) => <span className="clamp">{f.answer}</span> },
                { key: 'aud', header: 'Shown to', render: (f) => (f.audience === 'all' ? 'Everyone' : ROLE_LABEL[f.audience]) },
                { key: 'st', header: 'Status', render: (f) => <Badge value={f.active ? 'active' : 'inactive'} label={f.active ? 'Visible' : 'Hidden'} /> },
              ]}
            />
          )}
        </Loadable>
      </Card>
      {editing && (
        <FaqForm
          faq={editing === 'new' ? null : editing}
          nextSort={(state.data?.length ?? 0) + 1}
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

function FaqForm({ faq, nextSort, onClose, onSaved }: { faq: Faq | null; nextSort: number; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    question: faq?.question ?? '',
    answer: faq?.answer ?? '',
    audience: faq?.audience ?? 'all',
    sort: String(faq?.sort ?? nextSort),
    active: faq?.active ?? true,
  });
  const { run, busy, fields } = useAction();
  const confirm = useConfirm();

  async function submit(e: FormEvent) {
    e.preventDefault();
    const body = { ...form, sort: Number(form.sort) || 0 };
    const ok = faq ? await run(() => api.patch(`/faqs/${faq.id}`, body), 'FAQ updated') : await run(() => api.post('/faqs', body), 'FAQ added');
    if (ok) onSaved();
  }

  async function remove() {
    if (!faq) return;
    const ok = await confirm({
      title: 'Delete this FAQ?',
      tone: 'danger',
      confirmLabel: 'Delete',
      message: (
        <>
          <strong>{faq.question}</strong>
          <br />
          It disappears from the app immediately. This cannot be undone.
        </>
      ),
    });
    if (!ok) return;
    if ((await run(() => api.delete(`/faqs/${faq.id}`).then(() => true), 'FAQ deleted')) === true) onSaved();
  }

  return (
    <Modal
      title={faq ? 'Edit FAQ' : 'New FAQ'}
      onClose={onClose}
      wide
      footer={
        <>
          {faq && (
            <Button variant="danger" busy={busy} onClick={remove}>
              Delete
            </Button>
          )}
          <div className="spacer" />
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button form="faq-form" type="submit" busy={busy}>
            Save
          </Button>
        </>
      }
    >
      <form id="faq-form" className="stack" onSubmit={submit}>
        <Field label="Question *" error={fields.question}>
          <input required minLength={5} maxLength={200} value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} />
        </Field>
        <Field label="Answer *" error={fields.answer}>
          <textarea required rows={4} maxLength={2000} value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} />
        </Field>
        <div className="form-grid">
          <Field label="Shown to" error={fields.audience}>
            <select value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value as Faq['audience'] })}>
              <option value="all">Everyone</option>
              <option value="doctor">Doctors</option>
              <option value="mr">MRs</option>
              <option value="receptionist">Receptionists</option>
            </select>
          </Field>
          <Field label="Order" error={fields.sort}>
            <input type="number" value={form.sort} onChange={(e) => setForm({ ...form, sort: e.target.value })} />
          </Field>
        </div>
        <label className="check">
          <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Visible in the app
        </label>
      </form>
    </Modal>
  );
}
