import { Link } from 'react-router-dom';

import { api } from '../api/client';
import { Card, Loadable } from '../components/ui';
import { rupees } from '../lib/format';
import type { Dashboard as DashboardData } from '../lib/types';
import { useApi } from '../lib/useApi';

function Stat({ label, value, to, tone = 'blue' }: { label: string; value: string | number; to?: string; tone?: string }) {
  const body = (
    <>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </>
  );
  return to ? (
    <Link to={to} className={`stat stat-${tone}`}>
      {body}
    </Link>
  ) : (
    <div className={`stat stat-${tone}`}>{body}</div>
  );
}

function Trend({ points }: { points: DashboardData['appointmentTrend'] }) {
  const max = Math.max(1, ...points.map((p) => p.appointments));
  return (
    <div className="bars" role="img" aria-label="Appointments over the last 14 days">
      {points.map((p) => (
        <div key={p.date} className="bar-col" title={`${p.date}: ${p.appointments}`}>
          <span className="bar-num">{p.appointments || ''}</span>
          <div className="bar" style={{ height: `${(p.appointments / max) * 100}%` }} />
          <span className="bar-label">{p.date.slice(8)}</span>
        </div>
      ))}
    </div>
  );
}

export function Dashboard() {
  const state = useApi(() => api.get<DashboardData>('/admin/dashboard'), []);
  return (
    <>
      <h1 className="page-title">Dashboard</h1>
      <Loadable state={state}>
        {(d) => (
          <>
            <div className="stats">
              <Stat label="Active doctors" value={d.users.doctor} to="/users?role=doctor" />
              <Stat label="Active MRs" value={d.users.mr} to="/users?role=mr" />
              <Stat label="Active receptionists" value={d.users.receptionist} to="/users?role=receptionist" />
              <Stat label="New users (7 days)" value={d.newUsersLast7Days} tone="green" />
              <Stat label="Appointments next 7 days" value={d.upcomingNext7Days} to="/appointments" />
              <Stat label="Pending access requests" value={d.pendingAccessRequests} to="/access?status=pending" tone={d.pendingAccessRequests ? 'orange' : 'blue'} />
              <Stat label="Open help requests" value={d.openTickets} to="/tickets" tone={d.openTickets ? 'orange' : 'blue'} />
              <Stat label="Active subscriptions" value={d.activeSubscriptions} to="/billing" tone="green" />
              <Stat label={`Revenue 30 days (${d.revenueLast30Days.orders} orders)`} value={rupees(d.revenueLast30Days.paise)} to="/billing" tone="green" />
            </div>
            <div className="grid-2">
              <Card title="Appointments · last 14 days">
                <Trend points={d.appointmentTrend} />
              </Card>
              <Card title="Today">
                <ul className="kv">
                  {(['pending', 'approved', 'completed', 'cancelled'] as const).map((s) => (
                    <li key={s}>
                      <span className="muted">{s[0]!.toUpperCase() + s.slice(1)}</span>
                      <strong>{d.appointmentsToday[s] ?? 0}</strong>
                    </li>
                  ))}
                  <li>
                    <span className="muted">Inactive accounts</span>
                    <strong>{d.users.inactive}</strong>
                  </li>
                  <li>
                    <span className="muted">Deleted accounts</span>
                    <strong>{d.users.deleted}</strong>
                  </li>
                </ul>
              </Card>
            </div>
          </>
        )}
      </Loadable>
    </>
  );
}
