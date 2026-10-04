import { useMemo, useState } from 'react';

import type { BannerOptions, BannerTargeting } from '../lib/types';

type States = BannerOptions['states'];

const norm = (s: string) => s.toLowerCase().trim();

/**
 * Searchable location selection for banner targeting.
 *  - state:    pick exactly one state
 *  - city:     pick exactly one city (grouped by state)
 *  - multiple: any number of states and/or cities (states expand to show cities)
 */
export function LocationPicker({
  mode,
  states,
  value,
  onChange,
}: {
  mode: Exclude<BannerTargeting, 'all'>;
  states: States;
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const selected = new Set(value);

  const names = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of states) {
      m.set(s.id, s.name);
      for (const c of s.cities) m.set(c.id, `${c.name}, ${s.name}`);
    }
    return m;
  }, [states]);

  // Search matches a state name (shows all its cities) or a city name (shows that city).
  const visible = useMemo(() => {
    const term = norm(q);
    return states
      .map((s) => {
        const stateHit = !term || norm(s.name).includes(term);
        const cities = stateHit ? s.cities : s.cities.filter((c) => norm(c.name).includes(term));
        return { ...s, cities, total: s.cities.length, show: stateHit || cities.length > 0 };
      })
      .filter((s) => s.show);
  }, [states, q]);

  const pick = (id: string) => {
    if (mode === 'multiple') {
      const next = new Set(selected);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      onChange([...next]);
    } else {
      onChange([id]);
    }
  };
  const toggleOpen = (id: string) =>
    setOpen((o) => {
      const next = new Set(o);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const inputType = mode === 'multiple' ? 'checkbox' : 'radio';
  const showCities = mode !== 'state';
  const statesSelectable = mode !== 'city';
  const expanded = (id: string) => Boolean(q) || mode === 'city' || open.has(id);

  return (
    <div className="loc-picker">
      <input
        className="loc-search"
        placeholder={mode === 'state' ? 'Search states…' : mode === 'city' ? 'Search cities…' : 'Search states or cities…'}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Search locations"
      />
      {value.length > 0 && (
        <div className="chips loc-chips">
          {value.map((id) => (
            <span key={id} className="chip on">
              {names.get(id) ?? 'Unknown'}
              <button type="button" className="chip-x" aria-label={`Remove ${names.get(id)}`} onClick={() => onChange(value.filter((v) => v !== id))}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="loc-list" role="group" aria-label="Locations">
        {visible.length === 0 && <div className="muted small loc-empty">No locations match “{q}”.</div>}
        {visible.map((s) => (
          <div key={s.id} className="loc-state">
            <div className="loc-row">
              {showCities && s.cities.length > 0 && mode === 'multiple' && (
                <button type="button" className="loc-toggle" aria-expanded={expanded(s.id)} aria-label={`Show cities of ${s.name}`} onClick={() => toggleOpen(s.id)}>
                  {expanded(s.id) ? '▾' : '▸'}
                </button>
              )}
              {statesSelectable ? (
                <label className="loc-label">
                  <input type={inputType} name="loc" checked={selected.has(s.id)} onChange={() => pick(s.id)} />
                  <strong>{s.name}</strong>
                  <span className="muted small">state{showCities ? ` · ${s.total} ${s.total === 1 ? 'city' : 'cities'}` : ''}</span>
                </label>
              ) : (
                <span className="loc-label loc-heading">{s.name}</span>
              )}
            </div>
            {showCities && expanded(s.id) && (
              <div className="loc-cities">
                {s.cities.map((c) => (
                  <label key={c.id} className="loc-label">
                    <input type={inputType} name="loc" checked={selected.has(c.id)} onChange={() => pick(c.id)} />
                    {c.name}
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
