import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { api } from '../api/client';
import { ImageUpload } from '../components/ImageUpload';
import { LocationPicker } from '../components/LocationPicker';
import { Button, Card, Field, Loadable } from '../components/ui';
import type { Banner, BannerOptions, BannerStatus, BannerTargeting, RedirectType } from '../lib/types';
import { useAction } from '../lib/useAction';
import { useApi } from '../lib/useApi';
import { BannerPreview, STATUS_LABEL } from './Banners';

const TARGETING: { value: BannerTargeting; label: string; hint: string }[] = [
  { value: 'all', label: 'All locations', hint: 'Every doctor' },
  { value: 'state', label: 'Specific state', hint: 'One state — includes all its cities' },
  { value: 'city', label: 'Specific city', hint: 'One city only' },
  { value: 'multiple', label: 'Multiple locations', hint: 'Any mix of states and cities' },
];

/** Add (/banners/new) and Edit (/banners/:id/edit). */
export function BannerForm() {
  const { id } = useParams();
  const options = useApi(() => api.get<BannerOptions>('/admin/banners/options'), []);
  const banner = useApi(() => (id ? api.get<Banner>(`/admin/banners/${id}`) : Promise.resolve({ data: null })), [id]);
  return (
    <>
      <div className="row between page-head">
        <h1 className="page-title">{id ? 'Edit banner' : 'Add banner'}</h1>
        <Link to="/banners" className="btn btn-ghost">
          ← All banners
        </Link>
      </div>
      <Loadable state={options}>{(opts) => (id ? <Loadable state={banner}>{(b) => <Editor key={b?.id} banner={b} options={opts} />}</Loadable> : <Editor banner={null} options={opts} />)}</Loadable>
    </>
  );
}

interface Draft {
  title: string;
  description: string;
  image: { key: string; url: string } | null;
  mobileImage: { key: string; url: string } | null;
  showText: boolean;
  targeting: BannerTargeting;
  locationIds: string[];
  redirectType: RedirectType;
  internalTarget: string;
  externalUrl: string;
  status: BannerStatus;
  startDate: string;
  endDate: string;
  priority: string;
}

function initial(b: Banner | null): Draft {
  return {
    title: b?.title ?? '',
    description: b?.description ?? '',
    image: b?.imageKey && b.imageUrl ? { key: b.imageKey, url: b.imageUrl } : null,
    mobileImage: b?.mobileImageKey && b.mobileImageUrl ? { key: b.mobileImageKey, url: b.mobileImageUrl } : null,
    showText: b?.showText ?? false,
    targeting: b?.targeting ?? 'all',
    locationIds: b?.locations.map((l) => l.id) ?? [],
    redirectType: b?.redirectType ?? 'none',
    internalTarget: b?.redirectType === 'internal' ? (b.redirectTarget ?? '') : '',
    externalUrl: b?.redirectType === 'external' ? (b.redirectTarget ?? '') : '',
    status: b?.status ?? 'draft',
    startDate: b?.startDate ?? '',
    endDate: b?.endDate ?? '',
    priority: String(b?.priority ?? 10),
  };
}

function Editor({ banner, options }: { banner: Banner | null; options: BannerOptions }) {
  const navigate = useNavigate();
  const [d, setD] = useState<Draft>(() => initial(banner));
  const [local, setLocal] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const { run, busy, fields } = useAction();
  const errors = { ...fields, ...local };

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setD((x) => ({ ...x, [k]: v }));
    setDirty(true);
  };

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (d.title.trim().length < 3) e.title = 'At least 3 characters';
    if (!d.image) e.imageKey = 'Upload the banner image';
    if (d.targeting !== 'all' && d.locationIds.length === 0) e.locationIds = 'Pick at least one location';
    if ((d.targeting === 'state' || d.targeting === 'city') && d.locationIds.length !== 1) e.locationIds = `Pick exactly one ${d.targeting}`;
    if (d.redirectType === 'internal' && !d.internalTarget) e.redirectTarget = 'Choose an app screen';
    if (d.redirectType === 'external' && !/^https:\/\/[^\s/$.?#].[^\s]*$/i.test(d.externalUrl.trim())) e.redirectTarget = 'Use a full https:// link';
    if (d.startDate && d.endDate && d.endDate < d.startDate) e.endDate = 'End date must be on or after the start date';
    const p = Number(d.priority);
    if (!Number.isInteger(p) || p < 1 || p > 999) e.priority = 'Whole number from 1 (highest) to 999';
    return e;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const problems = validate();
    setLocal(problems);
    if (Object.keys(problems).length) return;
    const body = {
      title: d.title,
      description: d.description,
      imageKey: d.image!.key,
      mobileImageKey: d.mobileImage?.key ?? null,
      showText: d.showText,
      targeting: d.targeting,
      locationIds: d.targeting === 'all' ? [] : d.locationIds,
      redirectType: d.redirectType,
      redirectTarget: d.redirectType === 'internal' ? d.internalTarget : d.redirectType === 'external' ? d.externalUrl.trim() : null,
      status: d.status,
      startDate: d.startDate || null,
      endDate: d.endDate || null,
      priority: Number(d.priority),
    };
    const res = banner
      ? await run(() => api.put<Banner>(`/admin/banners/${banner.id}`, body), 'Banner saved')
      : await run(() => api.post<Banner>('/admin/banners', body), d.status === 'active' ? 'Banner created — doctors see it on their next refresh' : 'Banner saved as draft');
    if (res) {
      setDirty(false);
      navigate('/banners', { replace: true });
    }
  }

  const onTargeting = (t: BannerTargeting) => {
    // Keep the selection only if it still fits the new mode.
    const keep = t === 'multiple' ? d.locationIds : t === 'all' ? [] : d.locationIds.slice(0, 1);
    setD((x) => ({ ...x, targeting: t, locationIds: keep }));
    setDirty(true);
  };

  return (
    <form onSubmit={submit} noValidate>
      <div className="banner-form">
        <div className="stack">
          <Card title="Basic information">
            <div className="stack">
              <Field label="Banner title *" error={errors.title}>
                <input value={d.title} maxLength={120} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Telangana CME Conference" />
              </Field>
              <Field label="Description" hint="Optional · up to 300 characters" error={errors.description}>
                <textarea rows={2} maxLength={300} value={d.description} onChange={(e) => set('description', e.target.value)} />
              </Field>
              <ImageUpload label="Banner image *" value={d.image?.key ?? null} url={d.image?.url ?? null} missing={banner?.imageMissing && d.image?.key === banner.imageKey} error={errors.imageKey} onChange={(img) => set('image', img)} />
              <ImageUpload
                label="Mobile banner image (optional)"
                hint="Used by the app instead of the main image when set"
                optional
                value={d.mobileImage?.key ?? null}
                url={d.mobileImage?.url ?? null}
                error={errors.mobileImageKey}
                onChange={(img) => set('mobileImage', img)}
              />
              <label className="check">
                <input type="checkbox" checked={d.showText} onChange={(e) => set('showText', e.target.checked)} /> Show the title and description on the banner (for plain images without text)
              </label>
            </div>
          </Card>

          <Card title="Location targeting">
            <div className="target-options" role="radiogroup" aria-label="Target audience">
              {TARGETING.map((t) => (
                <label key={t.value} className={`target-option ${d.targeting === t.value ? 'on' : ''}`}>
                  <input type="radio" name="targeting" checked={d.targeting === t.value} onChange={() => onTargeting(t.value)} />
                  <span>
                    <strong>{t.label}</strong>
                    <span className="muted small">{t.hint}</span>
                  </span>
                </label>
              ))}
            </div>
            {d.targeting !== 'all' && (
              <>
                <LocationPicker mode={d.targeting} states={options.states} value={d.locationIds} onChange={(ids) => set('locationIds', ids)} />
                {errors.locationIds && <span className="field-error">{errors.locationIds}</span>}
              </>
            )}
            <p className="muted small">
              Doctors see city banners first, then state banners, then banners for all locations — each group ordered by priority. A city doctor also gets their state's banners.
            </p>
          </Card>

          <Card title="When tapped">
            <div className="form-grid">
              <Field label="Action">
                <select value={d.redirectType} onChange={(e) => set('redirectType', e.target.value as RedirectType)}>
                  <option value="none">No action</option>
                  <option value="internal">Open an app screen</option>
                  <option value="external">Open an external link</option>
                </select>
              </Field>
              {d.redirectType === 'internal' && (
                <Field label="App screen *" error={errors.redirectTarget}>
                  <select value={d.internalTarget} onChange={(e) => set('internalTarget', e.target.value)}>
                    <option value="">Choose screen</option>
                    {options.internalTargets.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              {d.redirectType === 'external' && (
                <Field label="Link *" hint="Must start with https://" error={errors.redirectTarget}>
                  <input type="url" inputMode="url" value={d.externalUrl} placeholder="https://example.com/event" onChange={(e) => set('externalUrl', e.target.value)} />
                </Field>
              )}
            </div>
          </Card>
        </div>

        <div className="stack banner-side">
          <Card title="Preview">
            <BannerPreview banner={{ title: d.title, description: d.description, imageUrl: d.image?.url ?? null, mobileImageUrl: d.mobileImage?.url ?? null, showText: d.showText, imageMissing: false }} />
          </Card>
          <Card title="Publishing">
            <div className="stack">
              <Field label="Status">
                <select value={d.status} onChange={(e) => set('status', e.target.value as BannerStatus)}>
                  <option value="draft">Draft — not visible</option>
                  <option value="active">Active — visible in its date window</option>
                  <option value="inactive">Inactive — hidden</option>
                </select>
              </Field>
              {banner && (
                <p className="muted small m0">
                  Currently: <strong>{STATUS_LABEL[banner.effectiveStatus]}</strong>
                </p>
              )}
              <div className="form-grid">
                <Field label="Start date" hint="Empty = immediately" error={errors.startDate}>
                  <input type="date" value={d.startDate} onChange={(e) => set('startDate', e.target.value)} />
                </Field>
                <Field label="End date" hint="Empty = no end" error={errors.endDate}>
                  <input type="date" value={d.endDate} min={d.startDate || undefined} onChange={(e) => set('endDate', e.target.value)} />
                </Field>
              </div>
              <Field label="Priority" hint="1 = shown first within its group" error={errors.priority}>
                <input type="number" min={1} max={999} value={d.priority} onChange={(e) => set('priority', e.target.value)} />
              </Field>
              <Button type="submit" busy={busy} className="btn-block">
                {banner ? 'Save changes' : 'Create banner'}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </form>
  );
}
