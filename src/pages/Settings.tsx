import { useState, type FormEvent } from 'react';

import { api } from '../api/client';
import { Button, Card, Field, Loadable } from '../components/ui';
import type { SupportSettings } from '../lib/types';
import { useAction } from '../lib/useAction';
import { useApi } from '../lib/useApi';

export function Settings() {
  const state = useApi(() => api.get<SupportSettings>('/admin/settings/support'), []);
  return (
    <>
      <h1 className="page-title">Settings</h1>
      <Loadable state={state}>{(s) => <SupportForm initial={s} onSaved={state.reload} />}</Loadable>
    </>
  );
}

function SupportForm({ initial, onSaved }: { initial: SupportSettings; onSaved: () => void }) {
  const [form, setForm] = useState({
    topics: initial.topics.join('\n'),
    whatsapp: initial.whatsapp ?? '',
    mr: initial.emails.mr,
    doctor: initial.emails.doctor,
    receptionist: initial.emails.receptionist,
  });
  const { run, busy, fields } = useAction();
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const body = {
      topics: form.topics.split('\n').map((t) => t.trim()).filter(Boolean),
      whatsapp: form.whatsapp.trim() || null,
      emails: { mr: form.mr.trim(), doctor: form.doctor.trim(), receptionist: form.receptionist.trim() },
    };
    if (await run(() => api.put('/support', body), 'Help Desk settings saved')) onSaved();
  }

  return (
    <Card title="Help Desk">
      <form className="stack" onSubmit={submit}>
        <Field label="Issue categories (one per line)" hint="Shown on the app's Help Desk screen. Existing requests keep their category." error={fields.topics}>
          <textarea rows={7} value={form.topics} onChange={set('topics')} />
        </Field>
        <Field label="WhatsApp number" hint="With country code, e.g. +919876543210. Leave empty to hide the WhatsApp button. Never shown to receptionists." error={fields.whatsapp}>
          <input value={form.whatsapp} onChange={set('whatsapp')} placeholder="+91…" />
        </Field>
        <div className="form-grid">
          <Field label="Support email · MRs" error={fields['emails.mr']}>
            <input type="email" required value={form.mr} onChange={set('mr')} />
          </Field>
          <Field label="Support email · Doctors" error={fields['emails.doctor']}>
            <input type="email" required value={form.doctor} onChange={set('doctor')} />
          </Field>
          <Field label="Support email · Receptionists" error={fields['emails.receptionist']}>
            <input type="email" required value={form.receptionist} onChange={set('receptionist')} />
          </Field>
        </div>
        <div>
          <Button type="submit" busy={busy}>
            Save
          </Button>
        </div>
      </form>
    </Card>
  );
}
