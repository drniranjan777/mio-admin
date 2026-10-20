const dateFmt = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export const fmtDate = (v?: string | null) => (v ? dateFmt.format(new Date(v)) : '—');
export const fmtDateTime = (v?: string | null) => (v ? dateTimeFmt.format(new Date(v)) : '—');

export const rupees = (paise: number) =>
  `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const titleCase = (s: string) => s.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export const ROLE_LABEL: Record<string, string> = { doctor: 'Doctor', mr: 'MR', receptionist: 'Receptionist', admin: 'Admin' };

/** Today in local time as YYYY-MM-DD. */
export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** "New Patient Consultation Fee" ranges (same keys as the API and the app). */
export const FEE_RANGE_LABEL: Record<string, string> = {
  'upto-100': 'Upto ₹100',
  '101-500': '₹101 to ₹500',
  '501-1000': '₹501 to ₹1000',
  '1001-2000': '₹1001 to ₹2000',
  '2001-3000': '₹2001 to ₹3000',
  '3001-4000': '₹3001 to ₹4000',
  '4001-5000': '₹4001 to ₹5000',
  '5001-10000': '₹5001 to ₹10000',
  'above-10000': 'More than ₹10,000',
};

/** Pharma companies a doctor takes MR calls from. */
export const COMPANY_TYPE_LABEL: Record<string, string> = {
  all: 'All',
  mnc: 'MNC/Indian MNC Calls only',
  startup: 'Startup/New/PCD Company Calls only',
};

type Consultation = { feeRange?: string; feePaise?: number } | undefined;
type MrCall = { days?: string[]; from?: string; to?: string; maxPerDay?: number; companyTypes?: string[] } | undefined;

/** Fee range label, or the exact fee saved by app builds before 1.0.4. */
export const feeLabel = (c: Consultation) =>
  c?.feeRange ? (FEE_RANGE_LABEL[c.feeRange] ?? c.feeRange) : c?.feePaise != null ? rupees(c.feePaise) : '';

/** "Mon, Tue · 09:00–13:00 · max 10/day · MNC/Indian MNC Calls only". */
export const mrCallLabel = (m: MrCall) =>
  m?.days?.length
    ? [
        m.days.join(', '),
        m.from && m.to ? `${m.from}–${m.to}` : '',
        m.maxPerDay ? `max ${m.maxPerDay}/day` : '',
        (m.companyTypes ?? []).map((t) => COMPANY_TYPE_LABEL[t] ?? t).join(', '),
      ]
        .filter(Boolean)
        .join(' · ')
    : '';
