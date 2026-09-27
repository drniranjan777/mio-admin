import { useRef, useState } from 'react';

import { api } from '../api/client';
import { Badge, Button, Modal, Table } from '../components/ui';
import { useAction } from '../lib/useAction';
import { useApi } from '../lib/useApi';

interface ImportRow {
  row: number;
  name: string;
  mobile: string;
  status: 'ok' | 'error' | 'created' | 'skipped';
  errors: string[];
}

interface ImportResult {
  committed: boolean;
  summary: { rows: number; valid: number; invalid: number; created: number; skipped: number };
  ignoredColumns: string[];
  rows: ImportRow[];
}

const MAX_BYTES = 2 * 1024 * 1024;
const STATUS_LABEL: Record<ImportRow['status'], [string, string]> = {
  ok: ['approved', 'Ready'],
  error: ['failed', 'Error'],
  created: ['completed', 'Imported'],
  skipped: ['inactive', 'Skipped'],
};

/** Upload → preview every row → import the valid ones. */
export function ImportDoctors({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const columns = useApi(() => api.get<{ columns: { key: string; hint: string }[]; maxRows: number }>('/admin/users/import/doctors/columns'), []);
  const { run, busy } = useAction();

  async function choose(f: File | undefined) {
    setResult(null);
    setReadError(null);
    if (!f) return;
    if (!/\.csv$/i.test(f.name)) return setReadError('Choose a .csv file (in Excel: File → Save As → CSV UTF-8).');
    if (f.size > MAX_BYTES) return setReadError('The file is larger than 2 MB. Split it into smaller files.');
    const text = await f.text();
    setFile({ name: f.name, text });
    const res = await run(() => api.postCsv<ImportResult>('/admin/users/import/doctors', text, { commit: false }));
    if (res) setResult(res.data);
  }

  async function commit() {
    if (!file || !result) return;
    const res = await run(
      () => api.postCsv<ImportResult>('/admin/users/import/doctors', file.text, { commit: true }),
      `${result.summary.valid} doctor(s) imported`,
    );
    if (res) {
      setResult(res.data);
      onImported();
    }
  }

  const rows = (result?.rows ?? []).filter((r) => !onlyErrors || r.status === 'error');
  return (
    <Modal
      title="Import doctors from CSV"
      onClose={onClose}
      wide
      footer={
        <>
          <Button
            variant="ghost"
            onClick={() => run(() => api.download('/admin/users/import/doctors/template', {}, 'doctors_import_template.csv'), 'Template downloaded')}
          >
            ⬇ Download demo sheet
          </Button>
          <div className="spacer" />
          <Button variant="ghost" onClick={onClose}>
            {result?.committed ? 'Done' : 'Cancel'}
          </Button>
          {result && !result.committed && (
            <Button busy={busy} disabled={result.summary.valid === 0} onClick={commit}>
              Import {result.summary.valid} doctor{result.summary.valid === 1 ? '' : 's'}
              {result.summary.invalid ? ` · skip ${result.summary.invalid}` : ''}
            </Button>
          )}
        </>
      }
    >
      <div className="stack">
        {!result && (
          <>
            <ol className="steps">
              <li>Download the demo sheet, fill one doctor per row (keep the header row). Open it in Excel or Google Sheets.</li>
              <li>
                Save as <strong>CSV (UTF-8)</strong> and upload it here. You will see every row checked before anything is saved.
              </li>
              <li>Imported doctors sign in with OTP on their mobile number and appear in the MR Master MCL.</li>
            </ol>
            {columns.data && (
              <details>
                <summary className="muted">Columns ({columns.data.columns.length}) · max {columns.data.maxRows} rows per file</summary>
                <ul className="kv small">
                  {columns.data.columns.map((c) => (
                    <li key={c.key}>
                      <code>{c.key}</code>
                      <span className="muted">{c.hint}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}

        <div className="row gap">
          <input ref={fileInput} type="file" accept=".csv,text/csv" hidden onChange={(e) => choose(e.target.files?.[0])} />
          <Button
            variant={result ? 'ghost' : 'primary'}
            busy={busy && !result}
            onClick={() => {
              if (fileInput.current) {
                fileInput.current.value = '';
                fileInput.current.click();
              }
            }}
          >
            {file ? 'Choose another file' : 'Choose CSV file'}
          </Button>
          {file && <span className="muted">{file.name}</span>}
        </div>
        {readError && <div className="error-box">{readError}</div>}

        {result && (
          <>
            <div className="row gap">
              <Badge value="blue" label={`${result.summary.rows} rows`} />
              {result.committed ? (
                <>
                  <Badge value="completed" label={`${result.summary.created} imported`} />
                  {result.summary.skipped > 0 && <Badge value="inactive" label={`${result.summary.skipped} skipped`} />}
                </>
              ) : (
                <>
                  <Badge value="approved" label={`${result.summary.valid} ready`} />
                  {result.summary.invalid > 0 && <Badge value="failed" label={`${result.summary.invalid} with errors`} />}
                </>
              )}
              <div className="spacer" />
              <label className="check small">
                <input type="checkbox" checked={onlyErrors} onChange={(e) => setOnlyErrors(e.target.checked)} /> Show only rows with errors
              </label>
            </div>
            {result.ignoredColumns.length > 0 && <p className="muted small m0">Ignored unknown columns: {result.ignoredColumns.join(', ')}</p>}
            {!result.committed && result.summary.invalid > 0 && (
              <p className="muted small m0">Fix the errors in your sheet and upload again, or import the ready rows now and the rest are skipped.</p>
            )}
            <Table
              rows={rows.map((r) => ({ ...r, id: String(r.row) }))}
              empty="No rows with errors."
              columns={[
                { key: 'row', header: 'Row', width: '56px', render: (r) => r.row },
                { key: 'name', header: 'Name', render: (r) => r.name || '—' },
                { key: 'mobile', header: 'Mobile', render: (r) => r.mobile || '—' },
                {
                  key: 'status',
                  header: 'Status',
                  render: (r) => <Badge value={STATUS_LABEL[r.status][0]} label={STATUS_LABEL[r.status][1]} />,
                },
                { key: 'errors', header: 'Problems', render: (r) => <span className="clamp">{r.errors.join(' · ') || '—'}</span> },
              ]}
            />
          </>
        )}
      </div>
    </Modal>
  );
}
