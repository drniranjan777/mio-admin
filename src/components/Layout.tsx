import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';
import type { Permission } from '../lib/types';

/** `perm: null` = Super Admin only. */
export const NAV: { to: string; label: string; icon: string; perm: Permission | null; end?: boolean }[] = [
  { to: '/', label: 'Dashboard', icon: '◧', perm: 'dashboard', end: true },
  { to: '/users', label: 'Users', icon: '👥', perm: 'users' },
  { to: '/access', label: 'Receptionist Access', icon: '🔑', perm: 'access' },
  { to: '/appointments', label: 'Appointments', icon: '📅', perm: 'appointments' },
  { to: '/conferences', label: 'Conferences', icon: '🎤', perm: 'conferences' },
  { to: '/banners', label: 'Banner Management', icon: '🖼', perm: 'banners' },
  { to: '/billing', label: 'Plans & Billing', icon: '💳', perm: 'billing' },
  { to: '/tickets', label: 'Help Desk', icon: '🛟', perm: 'tickets' },
  { to: '/reports', label: 'Reports', icon: '📊', perm: 'reports' },
  { to: '/faqs', label: 'FAQs', icon: '❓', perm: 'faqs' },
  { to: '/content', label: 'Terms & Policies', icon: '📄', perm: 'content' },
  { to: '/settings', label: 'Settings', icon: '⚙', perm: 'settings' },
  { to: '/audit', label: 'Audit Log', icon: '🧾', perm: 'audit' },
  { to: '/team', label: 'Admin Team & Roles', icon: '🛡', perm: null },
];

export function Layout() {
  const { user, access, can, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const items = NAV.filter((n) => (n.perm ? can(n.perm) : access?.isSuper));

  return (
    <div className={`shell ${open ? 'nav-open' : ''}`}>
      <aside className="sidebar">
        <div className="brand">
          <img src="/logo.png" alt="" width={32} height={32} />
          <div>
            <strong>Mio Doctors</strong>
            <span>Admin Panel</span>
          </div>
        </div>
        <nav>
          {items.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setOpen(false)} className={({ isActive }) => (isActive ? 'active' : '')}>
              <span className="nav-icon" aria-hidden>
                {n.icon}
              </span>
              {n.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setOpen((o) => !o)} aria-label="Menu">
            ☰
          </button>
          <div className="spacer" />
          <span className="muted">
            {user?.name || user?.email} · {access?.roleName ?? 'No role'}
          </span>
          <Link to="/password" className="btn btn-ghost btn-sm">
            Change password
          </Link>
          <button className="btn btn-ghost btn-sm" onClick={logout}>
            Sign out
          </button>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
      {open && <div className="nav-scrim" onClick={() => setOpen(false)} />}
    </div>
  );
}
