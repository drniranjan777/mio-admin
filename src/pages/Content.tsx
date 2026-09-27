import { useEffect, useState } from 'react';

import { api } from '../api/client';
import { Button, Card, Field, Loadable } from '../components/ui';
import { fmtDateTime } from '../lib/format';
import type { ContentPage } from '../lib/types';
import { useAction } from '../lib/useAction';
import { useApi } from '../lib/useApi';

const PAGES = [
  { key: 'terms-of-service', label: 'Terms of Service' },
  { key: 'terms-of-agreement', label: 'Terms of Agreement' },
  { key: 'privacy-policy', label: 'Privacy Policy' },
];

type Section = ContentPage['sections'][number];

export function Content() {
  const [key, setKey] = useState(PAGES[0]!.key);
  const state = useApi(
    () =>
      api.get<ContentPage>(`/content/${key}`).catch((err) => {
        // A page that was never written yet starts empty.
        if (err?.status === 404) return { data: { key, title: PAGES.find((p) => p.key === key)!.label, effectiveDate: '', sections: [], version: 0 } };
        throw err;
      }),
    [key],
  );

  return (
    <>
      <h1 className="page-title">Terms & Policies</h1>
      <div className="tabs" role="tablist">
        {PAGES.map((p) => (
          <button key={p.key} role="tab" aria-selected={key === p.key} className={key === p.key ? 'active' : ''} onClick={() => setKey(p.key)}>
            {p.label}
          </button>
        ))}
      </div>
      <Loadable state={state}>{(page) => <Editor key={`${page.key}-${page.version}`} page={page} onSaved={state.reload} />}</Loadable>
    </>
  );
}

function Editor({ page, onSaved }: { page: ContentPage; onSaved: () => void }) {
  const [draft, setDraft] = useState(page);
  const [dirty, setDirty] = useState(false);
  const { run, busy, fields } = useAction();

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const update = (patch: Partial<ContentPage>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setDirty(true);
  };
  const setSection = (i: number, patch: Partial<Section>) => update({ sections: draft.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const move = (i: number, dir: -1 | 1) => {
    const next = [...draft.sections];
    const [s] = next.splice(i, 1);
    next.splice(i + dir, 0, s!);
    update({ sections: next });
  };

  async function save() {
    const body = {
      title: draft.title.trim(),
      effectiveDate: draft.effectiveDate,
      ...(draft.intro?.trim() && { intro: draft.intro.trim() }),
      sections: draft.sections.map((s) => ({
        title: s.title.trim(),
        ...(s.body?.trim() && { body: s.body.trim() }),
        points: s.points.map((p) => p.trim()).filter(Boolean),
      })),
    };
    if (await run(() => api.put(`/content/${page.key}`, body), 'Published — the app shows the new version now')) {
      setDirty(false);
      onSaved();
    }
  }

  return (
    <Card
      title={`Version ${page.version || '—'}`}
      actions={
        <>
          {page.updatedAt && <span className="muted small">Last saved {fmtDateTime(page.updatedAt)}</span>}
          <Button busy={busy} disabled={!dirty} onClick={save}>
            Publish changes
          </Button>
        </>
      }
    >
      <div className="stack">
        <div className="form-grid">
          <Field label="Title" error={fields.title}>
            <input value={draft.title} onChange={(e) => update({ title: e.target.value })} />
          </Field>
          <Field label="Effective date" error={fields.effectiveDate}>
            <input type="date" value={draft.effectiveDate} onChange={(e) => update({ effectiveDate: e.target.value })} />
          </Field>
        </div>
        <Field label="Introduction" error={fields.intro}>
          <textarea rows={3} value={draft.intro ?? ''} onChange={(e) => update({ intro: e.target.value })} />
        </Field>
        {draft.sections.map((s, i) => (
          <div key={i} className="section-edit">
            <div className="row gap">
              <input className="grow" value={s.title} placeholder="Section title" onChange={(e) => setSection(i, { title: e.target.value })} />
              <Button variant="ghost" size="sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">
                ↑
              </Button>
              <Button variant="ghost" size="sm" disabled={i === draft.sections.length - 1} onClick={() => move(i, 1)} aria-label="Move down">
                ↓
              </Button>
              <Button variant="danger" size="sm" onClick={() => update({ sections: draft.sections.filter((_, j) => j !== i) })}>
                Remove
              </Button>
            </div>
            <textarea rows={2} placeholder="Paragraph (optional)" value={s.body ?? ''} onChange={(e) => setSection(i, { body: e.target.value })} />
            <textarea
              rows={Math.max(2, s.points.length)}
              placeholder="Bullet points — one per line (optional)"
              value={s.points.join('\n')}
              onChange={(e) => setSection(i, { points: e.target.value.split('\n') })}
            />
          </div>
        ))}
        <Button variant="ghost" onClick={() => update({ sections: [...draft.sections, { title: '', body: '', points: [] }] })}>
          + Add section
        </Button>
      </div>
    </Card>
  );
}
