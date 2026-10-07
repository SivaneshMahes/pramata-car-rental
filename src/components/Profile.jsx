import React, { useState } from 'react';
import { api, setCsrf } from '../api';
import { Field, ErrorBox, Icon, useLoad } from './UI';
export default function Profile({ user, onUpdated, notify }) {
  const state = useLoad('/profile');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [passwordError, setPasswordError] = useState(''),
    [passwordBusy, setPasswordBusy] = useState(false);
  async function save(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    const body = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const result = await api('/profile', { method: 'PATCH', body });
      onUpdated(result.user);
      notify('Your profile has been updated.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function password(event) {
    event.preventDefault();
    if (passwordBusy) return;
    const form = event.currentTarget,
      body = Object.fromEntries(new FormData(form));
    if (body.password !== body.confirm_password)
      return setPasswordError('The new passwords don’t match.');
    setPasswordBusy(true);
    setPasswordError('');
    try {
      const result = await api('/profile/password', { method: 'POST', body });
      setCsrf(result.csrf);
      onUpdated(result.user);
      form.reset();
      notify('Password changed. Other sessions have been signed out.');
    } catch (err) {
      setPasswordError(err.message);
    } finally {
      setPasswordBusy(false);
    }
  }
  return (
    <div className="page-wrap profile-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR ACCOUNT</span>
          <h1>Make yourself at home.</h1>
          <p className="muted">Your details, ready for your next journey.</p>
        </div>
      </div>
      {state.loading ? (
        <p role="status">Loading your profile…</p>
      ) : state.error ? (
        <ErrorBox message={state.error} onRetry={state.retry} />
      ) : (
        <div className="profile-layout">
          <aside className="profile-summary">
            <span className="avatar profile-avatar">{user.name.slice(0, 1).toUpperCase()}</span>
            <h2>{user.name}</h2>
            <p>{user.role === 'owner' ? 'Vehicle owner' : 'Customer'}</p>
            <div className="profile-facts">
              <span>
                <Icon name="shield" size={18} />
                {state.data.googleLinked ? 'Google account connected' : 'Email & password account'}
              </span>
              <span>
                <Icon name="calendar" size={18} />
                Joined{' '}
                {new Date(state.data.createdAt.replace(' ', 'T') + 'Z').toLocaleDateString(
                  'en-IN',
                  { month: 'long', year: 'numeric' },
                )}
              </span>
            </div>
            <a
              className="button secondary full"
              href={user.role === 'owner' ? '#owner' : '#rentals'}
            >
              {user.role === 'owner' ? 'Manage my vehicles' : 'View my rentals'}
              <Icon name="right" size={16} />
            </a>
          </aside>
          <div className="profile-sections">
            <section className="profile-section" aria-labelledby="profile-details">
              <h2 id="profile-details">Personal details</h2>
              <p className="muted">
                Your name appears on bookings{user.role === 'owner' ? ' and vehicle listings' : ''}.
                Phone, city and notes stay private.
              </p>
              <form onSubmit={save} className="form-stack" aria-busy={busy}>
                <Field label={user.role === 'owner' ? 'Your name or business name' : 'Full name'}>
                  <input
                    name="name"
                    defaultValue={state.data.name}
                    autoComplete="name"
                    required
                    minLength={2}
                    maxLength={80}
                  />
                </Field>
                <Field
                  label="Email address"
                  hint="Your sign-in email is fixed to protect your account identity."
                >
                  <input value={user.email} readOnly type="email" />
                </Field>
                <div className="form-row">
                  <Field label="Phone number (optional)">
                    <input
                      name="phone"
                      type="tel"
                      autoComplete="tel"
                      defaultValue={state.data.phone}
                      maxLength={25}
                      placeholder="+91 98765 43210"
                    />
                  </Field>
                  <Field label="Home city (optional)">
                    <input
                      name="city"
                      autoComplete="address-level2"
                      defaultValue={state.data.city}
                      maxLength={80}
                      placeholder="Chennai"
                    />
                  </Field>
                </div>
                <Field
                  label={
                    user.role === 'owner'
                      ? 'About your rental business (private notes)'
                      : 'About you (private notes)'
                  }
                  hint="Optional · up to 500 characters."
                >
                  <textarea name="bio" defaultValue={state.data.bio} maxLength={500} rows={3} />
                </Field>
                <ErrorBox message={error} />
                <button className="button primary" disabled={busy}>
                  {busy ? 'Saving…' : 'Save changes'}
                  <Icon name="check" size={18} />
                </button>
              </form>
            </section>
            <section className="profile-section" aria-labelledby="profile-security">
              <h2 id="profile-security">Account security</h2>
              {state.data.hasPassword ? (
                <>
                  <p className="muted">Changing your password signs out your other sessions.</p>
                  <form className="form-stack" onSubmit={password} aria-busy={passwordBusy}>
                    <Field label="Current password">
                      <input
                        name="current_password"
                        type="password"
                        autoComplete="current-password"
                        required
                        maxLength={128}
                      />
                    </Field>
                    <div className="form-row">
                      <Field label="New password" hint="Use 10–128 characters.">
                        <input
                          name="password"
                          type="password"
                          autoComplete="new-password"
                          required
                          minLength={10}
                          maxLength={128}
                        />
                      </Field>
                      <Field label="Confirm new password">
                        <input
                          name="confirm_password"
                          type="password"
                          autoComplete="new-password"
                          required
                          minLength={10}
                          maxLength={128}
                        />
                      </Field>
                    </div>
                    <ErrorBox message={passwordError} />
                    <button className="button secondary" disabled={passwordBusy}>
                      {passwordBusy ? 'Updating…' : 'Update password'}
                      <Icon name="key" size={18} />
                    </button>
                  </form>
                </>
              ) : (
                <p className="muted">
                  You sign in with Google. Manage your password and sign-in security in your Google
                  account.
                </p>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
