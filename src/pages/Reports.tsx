import { useState } from 'react';

import { api } from '../api/client';
import { Button, Card, Loadable, Select, Table } from '../components/ui';
import { todayIso } from '../lib/format';
import type { ReportFilters, ReportResult } from '../lib/types';
import { useAction } from '../lib/useAction';
import { useApi } from '../lib/useApi';

const shiftDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function Reports() {
  const filters = useApi(() => api.get<ReportFilters>('/reports/filters'), []);
  const [type, setType] = useState('');
  const [from, setFrom] = useState(shiftDays(-30));
  const [to, setTo] = useState(shiftDays(30));
  const [doctorId, setDoctorId] = useState('');
  const [mrId, setMrId] = useState('');
  const [company, setCompany] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [city, setCity] = useState('');
  const query = { from, to, doctorId, mrId, company, specialty, city };
  const [shown, setShown] = useState<{ type: string; query: typeof query } | null>(null);
  const { run, busy } = useAction();

  const exportAs = (format: 'xlsx' | 'csv', reportType = type) =>
    run(() => api.download(`/reports/${reportType}`, { ...query, format }, `${reportType}_${todayIso()}.${format}`), format === 'xlsx' ? 'Excel file downloaded' : 'CSV downloaded');

  return (
    <>
      <h1 className="page-title">Reports</h1>
      <Loadable state={filters}>
        {(f) => {
          const effectiveType = type || f.reports[0]?.type || '';
          return (
            <>
              <Card title="Build a report">
                <div className="form-grid report-filters">
                  <label className="field">
                    <span className="field-label">Report</span>
                    <Select value={effectiveType} onChange={setType} options={f.reports.map((r) => ({ value: r.type, label: r.title }))} />
                  </label>
                  <label className="field">
                    <span className="field-label">From</span>
                    <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                  </label>
                  <label className="field">
                    <span className="field-label">To</span>
                    <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                  </label>
                  <label className="field">
                    <span className="field-label">Doctor</span>
                    <Select value={doctorId} onChange={setDoctorId} options={f.doctors.map((d) => ({ value: d.id, label: d.name }))} placeholder="All doctors" />
                  </label>
                  <label className="field">
                    <span className="field-label">MR</span>
                    <Select value={mrId} onChange={setMrId} options={f.mrs.map((m) => ({ value: m.id, label: m.name }))} placeholder="All MRs" />
                  </label>
                  <label className="field">
                    <span className="field-label">Company</span>
                    <Select value={company} onChange={setCompany} options={f.companies.map((c) => ({ value: c, label: c }))} placeholder="All companies" />
                  </label>
                  <label className="field">
                    <span className="field-label">Specialty</span>
                    <Select value={specialty} onChange={setSpecialty} options={f.specialties.map((s) => ({ value: s, label: s }))} placeholder="All specialties" />
                  </label>
                  <label className="field">
                    <span className="field-label">City</span>
                    <Select value={city} onChange={setCity} options={f.cities.map((c) => ({ value: c, label: c }))} placeholder="All cities" />
                  </label>
                </div>
                <div className="row gap" style={{ marginTop: 14 }}>
                  <Button onClick={() => setShown({ type: effectiveType, query })}>Show report</Button>
                  <Button variant="success" busy={busy} onClick={() => exportAs('xlsx', effectiveType)}>
                    ⬇ Export Excel
                  </Button>
                  <Button variant="ghost" busy={busy} onClick={() => exportAs('csv', effectiveType)}>
                    ⬇ Export CSV
                  </Button>
                </div>
              </Card>
              {shown && <ReportView key={JSON.stringify(shown)} type={shown.type} query={shown.query} />}
            </>
          );
        }}
      </Loadable>
    </>
  );
}

function ReportView({ type, query }: { type: string; query: Record<string, string> }) {
  const state = useApi(() => api.get<ReportResult>(`/reports/${type}`, query), [type]);
  return (
    <Loadable state={state}>
      {(r) => (
        <Card title={r.title} actions={<span className="muted small">{`${r.from} → ${r.to} · ${r.rows.length} rows`}</span>}>
          <Table<Record<string, string | number | null> & { id: string }>
            rows={r.rows.map((row, i) => ({ ...row, id: String(i) }))}
            empty="No data for this period and filters."
            columns={r.columns.map((c) => ({ key: c.key, header: c.label, render: (row) => String(row[c.key] ?? '—') }))}
          />
          {r.truncated && <p className="muted small">Only the first {r.rows.length} rows are shown. Narrow the dates for the rest.</p>}
        </Card>
      )}
    </Loadable>
  );
}
