import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Button, Field, useToast } from '../components/ui';

/** Own password change. Shown on its own when a temporary password must be replaced. */
export function ChangePassword({ forced = false }: { forced?: boolean }) {
  const { changePassword, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (next !== confirm) {
      setErrors({ confirm: 'Passwords do not match' });
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      await changePassword(current, next);
      toast('Password changed');
      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) setErrors({ ...err.fields, ...(Object.keys(err.fields).length ? {} : { form: err.message }) });
      else setErrors({ form: 'Could not change the password' });
    } finally {
      setBusy(false);
    }
  }

  const form = (
    <form className="login-card" onSubmit={submit}>
      <img src="/logo.png" alt="" width={48} height={48} />
      <h1>{forced ? 'Set your password' : 'Change password'}</h1>
      <p className="muted">
        {forced ? 'You signed in with a temporary password. Choose your own to continue.' : 'All your other sessions will be signed out.'}
      </p>
      <Field label={forced ? 'Temporary password' : 'Current password'} error={errors.currentPassword}>
        <input type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
      </Field>
      <Field label="New password" hint="At least 12 characters recommended" error={errors.newPassword}>
        <input type="password" autoComplete="new-password" required value={next} onChange={(e) => setNext(e.target.value)} />
      </Field>
      <Field label="Confirm new password" error={errors.confirm}>
        <input type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </Field>
      {errors.form && (
        <div className="error-box" role="alert">
          {errors.form}
        </div>
      )}
      <Button type="submit" busy={busy} className="btn-block">
        Save password
      </Button>
      {forced && (
        <Button type="button" variant="ghost" onClick={logout}>
          Sign out
        </Button>
      )}
    </form>
  );

  return forced ? <div className="login-page">{form}</div> : <div className="center-page">{form}</div>;
}
