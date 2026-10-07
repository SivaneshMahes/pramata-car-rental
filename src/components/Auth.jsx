import React, { useState } from 'react';
import { api, setCsrf } from '../api';
import { Field, Select, ErrorBox, Icon } from './UI';
export default function Auth({ mode = 'login', onSignedIn, google, demo }) {
  const [role, setRole] = useState('customer'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [showPassword, setShowPassword] = useState(false);
  const register = mode === 'register';
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setError('');
    setBusy(true);
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const result = await api(`/auth/${mode}`, { method: 'POST', body: { ...data, role } });
      setCsrf(result.csrf);
      onSignedIn(result.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="auth-page" aria-labelledby="auth-heading">
      <div className="auth-art">
        <img
          src="/images/hero.jpg"
          alt="A silver sports car taking a bend on an open road"
          fetchPriority="high"
        />
        <div className="auth-art-copy">
          <span className="auth-kicker">WHEELS 2 GO</span>
          <h2>
            A little freedom.
            <br />A lot of possibility.
          </h2>
          <p>
            The city, the coast, the long way home.
            <br />
            Find the right ride for wherever’s next.
          </p>
        </div>
        <div className="auth-road-note">
          <Icon name="road" size={26} />
          <div>
            <strong>Your next journey starts here</strong>
            <span>Cars, SUVs, bikes & vans · Local vehicle owners</span>
          </div>
        </div>
      </div>
      <div className="auth-form-panel">
        <a href="#explore" className="back-link">
          <Icon name="left" size={17} />
          Back to vehicles
        </a>
        <span className="eyebrow">
          {register ? 'LET’S GET YOU MOVING' : 'GOOD TO SEE YOU AGAIN'}
        </span>
        <h1 id="auth-heading">{register ? 'Your next chapter.' : 'Welcome back.'}</h1>
        <p className="muted">
          {register
            ? 'Create an account to rent your next ride or manage your own fleet.'
            : 'Sign in to keep your journeys and your fleet in one place.'}
        </p>
        <form onSubmit={submit} className="form-stack" aria-busy={busy}>
          {register && (
            <Field label="Full name">
              <input name="name" autoComplete="name" required minLength={2} maxLength={80} />
            </Field>
          )}
          <Field label="Email address">
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              placeholder="you@example.com"
            />
          </Field>
          <div className="password-field">
            <Field label="Password" hint={register ? 'Use 10–128 characters.' : undefined}>
              <input
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={register ? 'new-password' : 'current-password'}
                required
                minLength={register ? 10 : 1}
                maxLength={128}
              />
            </Field>
            <button
              type="button"
              className="password-toggle icon-button"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((x) => !x)}
            >
              <Icon name={showPassword ? 'hidden' : 'eye'} />
            </button>
          </div>
          {(register || google) && (
            <Field label={register ? 'I’m here to' : 'If this is your first Google sign-in'}>
              <Select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="customer">Rent a vehicle</option>
                <option value="owner">List and manage my vehicles</option>
              </Select>
            </Field>
          )}
          <ErrorBox message={error} />
          <button className="button primary full" disabled={busy}>
            {busy ? 'Signing you in…' : register ? 'Create account' : 'Sign in'}
            <Icon name="right" size={18} />
          </button>
        </form>
        {google && (
          <>
            <div className="auth-divider">
              <span>or</span>
            </div>
            <a
              className={`button secondary full google-button ${busy ? 'disabled-link' : ''}`}
              aria-disabled={busy}
              tabIndex={busy ? -1 : undefined}
              href={`/api/auth/google?role=${role}&returnTo=${encodeURIComponent(sessionStorage.getItem('wheels-return') || '')}`}
            >
              <img
                className="google-logo"
                src="/brand/google-g.png"
                alt=""
                width="20"
                height="20"
              />
              Continue with Google
            </a>
          </>
        )}
        <p className="auth-switch">
          {register ? 'Already have an account?' : 'New to Wheels 2 Go?'}{' '}
          <a href={register ? '#login' : '#register'}>{register ? 'Sign in' : 'Create account'}</a>
        </p>
        <div className="auth-assurance">
          <Icon name="shield" size={18} />
          <span>Secure sign-in. Your rental details stay in your account.</span>
        </div>
        {demo && (
          <details className="demo-credentials">
            <summary>Explore with a demo account</summary>
            <p>
              Customer: <code>customer@siva.test</code>
              <br />
              Owner: <code>owner@siva.test</code>
              <br />
              Password: <code>SivaDemo2026!</code>
            </p>
            <p>Demo accounts share persistent sample data.</p>
          </details>
        )}
      </div>
    </section>
  );
}
