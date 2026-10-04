import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AuthProvider, useAuth } from './auth/AuthContext';
import { ConfirmProvider } from './components/ConfirmDialog';
import { Layout, NAV } from './components/Layout';
import { Empty, Spinner, ToastProvider } from './components/ui';
import type { Permission } from './lib/types';
import { Access } from './pages/Access';
import { Appointments } from './pages/Appointments';
import { Audit } from './pages/Audit';
import { BannerForm } from './pages/BannerForm';
import { Banners } from './pages/Banners';
import { Billing } from './pages/Billing';
import { ChangePassword } from './pages/ChangePassword';
import { Conferences } from './pages/Conferences';
import { Content } from './pages/Content';
import { Dashboard } from './pages/Dashboard';
import { Faqs } from './pages/Faqs';
import { Login } from './pages/Login';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { Team } from './pages/Team';
import { Tickets } from './pages/Tickets';
import { Users } from './pages/Users';

function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  if (!ready) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  // A temporary password must be replaced before anything else.
  if (user.mustChangePassword) return <ChangePassword forced />;
  return children;
}

/** Hides sections outside the admin's role (the API refuses them anyway). */
function Allow({ perm, children }: { perm: Permission | null; children: ReactNode }) {
  const { can, access } = useAuth();
  const allowed = perm ? can(perm) : access?.isSuper;
  return allowed ? children : <Empty>Your role does not include this section.</Empty>;
}

/** Landing page: the dashboard, or the first section the role can open. */
function Home() {
  const { can, access } = useAuth();
  if (can('dashboard')) return <Dashboard />;
  const first = NAV.find((n) => (n.perm ? can(n.perm) : access?.isSuper));
  return first ? <Navigate to={first.to} replace /> : <Empty>Your role has no sections yet. Ask a Super Admin.</Empty>;
}

const guarded = (perm: Permission | null, el: ReactNode) => <Allow perm={perm}>{el}</Allow>;

export function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              element={
                <RequireAdmin>
                  <Layout />
                </RequireAdmin>
              }
            >
              <Route index element={<Home />} />
              <Route path="users" element={guarded('users', <Users />)} />
              <Route path="access" element={guarded('access', <Access />)} />
              <Route path="appointments" element={guarded('appointments', <Appointments />)} />
              <Route path="conferences" element={guarded('conferences', <Conferences />)} />
              <Route path="banners" element={guarded('banners', <Banners />)} />
              <Route path="banners/new" element={guarded('banners', <BannerForm />)} />
              <Route path="banners/:id/edit" element={guarded('banners', <BannerForm />)} />
              <Route path="billing" element={guarded('billing', <Billing />)} />
              <Route path="tickets" element={guarded('tickets', <Tickets />)} />
              <Route path="reports" element={guarded('reports', <Reports />)} />
              <Route path="faqs" element={guarded('faqs', <Faqs />)} />
              <Route path="content" element={guarded('content', <Content />)} />
              <Route path="settings" element={guarded('settings', <Settings />)} />
              <Route path="audit" element={guarded('audit', <Audit />)} />
              <Route path="team" element={guarded(null, <Team />)} />
              <Route path="password" element={<ChangePassword />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}
