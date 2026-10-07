import React, { useEffect, useState, useCallback, useRef } from 'react';
import { api, setCsrf } from './api';
import { Icon, ErrorBox, Modal, Empty } from './components/UI';
import Explore from './components/Explore';
import Auth from './components/Auth';
import Brand from './components/Brand';
import Profile from './components/Profile';
import VehicleDetail from './components/VehicleDetail';
import Dashboard from './components/Dashboard';
import Saved from './components/Saved';
function readRoute() {
  return (
    window.location.hash.slice(1) ||
    (['/login', '/register'].includes(window.location.pathname)
      ? window.location.pathname.slice(1)
      : 'explore')
  );
}
export default function App() {
  const [route, setRoute] = useState(readRoute),
    [user, setUser] = useState(null),
    [ready, setReady] = useState(false),
    [sessionError, setSessionError] = useState(''),
    [google, setGoogle] = useState(false),
    [demo, setDemo] = useState(false),
    [version, setVersion] = useState(0),
    [saved, setSaved] = useState([]),
    [notifications, setNotifications] = useState([]),
    [inbox, setInbox] = useState(false),
    [mobileNav, setMobileNav] = useState(false),
    [toast, setToast] = useState(null),
    [actionBusy, setActionBusy] = useState(false);
  function setAuth(mode) {
    if (!['login', 'register'].includes(route)) sessionStorage.setItem('wheels-return', route);
    window.location.hash = mode || 'explore';
  }
  function signedIn(signedIn) {
    setUser(signedIn);
    changed();
    notify(`Welcome, ${signedIn.name.split(' ')[0]}.`);
    const destination = sessionStorage.getItem('wheels-return');
    sessionStorage.removeItem('wheels-return');
    const allowedReturn = [
      'profile',
      ...(signedIn.role === 'owner' ? ['owner', 'bookings'] : ['rentals', 'saved']),
    ];
    window.location.hash =
      destination && (destination.startsWith('vehicle/') || allowedReturn.includes(destination))
        ? destination
        : signedIn.role === 'owner'
          ? 'owner'
          : 'rentals';
  }
  const toastTimer = useRef(null);
  const notificationBusy = useRef(false);
  const notify = useCallback((message, error = false) => {
    setToast({ message, error });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 6000);
  }, []);
  const changed = useCallback(() => setVersion((x) => x + 1), []);
  async function session() {
    setSessionError('');
    try {
      const result = await api('/auth/me');
      setCsrf(result.csrf);
      setUser(result.user);
      setGoogle(result.google);
      setDemo(result.demo);
      setReady(true);
    } catch (err) {
      setSessionError(err.message);
      setReady(true);
    }
  }
  useEffect(() => {
    session();
    const handle = () => {
      setRoute(readRoute());
      setMobileNav(false);
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', handle);
    const url = new URL(window.location.href);
    if (url.searchParams.has('authError')) notify(url.searchParams.get('authError'), true);
    if (url.searchParams.get('auth') === 'success') {
      sessionStorage.removeItem('wheels-return');
      notify('Signed in with Google.');
    }
    if (url.search) {
      url.search = '';
      window.history.replaceState({}, '', url);
    }
    return () => {
      window.removeEventListener('hashchange', handle);
      clearTimeout(toastTimer.current);
    };
  }, [notify]);
  useEffect(() => {
    const expired = () => {
      setUser(null);
      setInbox(false);
      sessionStorage.setItem('wheels-return', readRoute());
      window.location.hash = 'login';
      notify('Your session expired. Sign in to continue.', true);
    };
    window.addEventListener('wheels-session-expired', expired);
    return () => window.removeEventListener('wheels-session-expired', expired);
  }, [notify]);
  useEffect(() => {
    const titles = {
      login: 'Sign in',
      register: 'Create account',
      profile: 'Profile',
      saved: 'Saved vehicles',
      rentals: 'My rentals',
      owner: 'My vehicles',
      bookings: 'Bookings',
    };
    document.title = `${titles[route] || (route.startsWith('vehicle/') ? 'Vehicle details' : 'Find your next ride')} · Wheels 2 Go`;
  }, [route]);
  useEffect(() => {
    let active = true;
    if (user?.role === 'customer')
      api('/favorite-ids')
        .then((ids) => {
          if (active) setSaved(ids);
        })
        .catch((err) => notify(err.message, true));
    else setSaved([]);
    return () => {
      active = false;
    };
  }, [user, version, notify]);
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }
    let active = true;
    const load = () =>
      api('/notifications')
        .then((items) => {
          if (active) setNotifications(items);
        })
        .catch((err) => {
          if (active) notify(err.message, true);
        });
    load();
    const events = new EventSource('/api/notifications/stream');
    events.addEventListener('connected', load);
    events.addEventListener('notification', () => {
      load();
      changed();
    });
    const focus = () => {
      session();
      changed();
    };
    window.addEventListener('focus', focus);
    return () => {
      active = false;
      events.close();
      window.removeEventListener('focus', focus);
    };
  }, [user, changed, notify]);
  async function saveVehicle(id) {
    if (!user) return setAuth('login');
    if (user.role !== 'customer') return notify('Use a customer account to save vehicles.', true);
    if (actionBusy) return;
    setActionBusy(true);
    try {
      const isSaved = saved.includes(id);
      await api(`/favorites/${id}`, { method: isSaved ? 'DELETE' : 'PUT' });
      setSaved((old) => (isSaved ? old.filter((x) => x !== id) : [...old, id]));
      changed();
      notify(isSaved ? 'Vehicle removed from saved.' : 'Vehicle saved for later.');
    } catch (err) {
      notify(err.message, true);
    } finally {
      setActionBusy(false);
    }
  }
  async function logout() {
    if (actionBusy) return;
    setActionBusy(true);
    try {
      await api('/auth/logout', { method: 'POST' });
      setCsrf(null);
      setUser(null);
      setInbox(false);
      sessionStorage.removeItem('wheels-return');
      window.location.hash = 'explore';
      notify('You’ve signed out.');
    } catch (err) {
      notify(err.message, true);
    } finally {
      setActionBusy(false);
    }
  }
  async function markRead() {
    if (notificationBusy.current) return;
    notificationBusy.current = true;
    try {
      await api('/notifications/read', { method: 'PATCH' });
      setNotifications((old) => old.map((x) => ({ ...x, seen: 1 })));
    } catch (err) {
      notify(err.message, true);
    } finally {
      notificationBusy.current = false;
    }
  }
  const nav =
    user?.role === 'owner'
      ? [
          ['explore', 'Explore'],
          ['owner', 'My vehicles'],
          ['bookings', 'Bookings'],
          ['profile', 'Profile'],
        ]
      : [
          ['explore', 'Explore'],
          ['rentals', 'My rentals'],
          ['saved', 'Saved vehicles'],
          ['profile', 'Profile'],
        ];
  const isProtected = ['owner', 'bookings', 'rentals', 'saved', 'profile'].includes(route);
  const allowed =
    ['explore', 'login', 'register', 'profile'].includes(route) ||
    route.startsWith('vehicle/') ||
    (user?.role === 'owner'
      ? ['owner', 'bookings'].includes(route)
      : ['rentals', 'saved'].includes(route));
  let content;
  if (!ready)
    content = (
      <div className="page-wrap">
        <div className="page-loading">Getting things ready…</div>
      </div>
    );
  else if (sessionError)
    content = (
      <div className="page-wrap">
        <ErrorBox message={sessionError} onRetry={session} />
      </div>
    );
  else if (isProtected && !user)
    content = (
      <div className="page-wrap">
        <Empty
          title="Your journeys, all in one place"
          body="Sign in to view rentals, saved vehicles or your fleet."
          action={
            <button className="button primary" onClick={() => setAuth('login')}>
              Sign in
            </button>
          }
        />
      </div>
    );
  else if (!allowed)
    content = (
      <div className="page-wrap">
        <Empty
          title="This page isn’t available"
          body="Choose a page from the navigation to continue."
          action={
            <a className="button primary" href="#explore">
              Explore vehicles
            </a>
          }
        />
      </div>
    );
  else if (route === 'login' || route === 'register')
    content = user ? (
      <div className="page-wrap">
        <Empty
          title="You’re already signed in"
          body={`Continue as ${user.name}.`}
          action={
            <a className="button primary" href="#profile">
              View profile
            </a>
          }
        />
      </div>
    ) : (
      <Auth key={route} mode={route} google={google} demo={demo} onSignedIn={signedIn} />
    );
  else if (route === 'profile')
    content = (
      <Profile
        user={user}
        onUpdated={(updated) => {
          setUser(updated);
          changed();
        }}
        notify={notify}
      />
    );
  else if (route.startsWith('vehicle/'))
    content = (
      <VehicleDetail
        key={route}
        id={route.split('/')[1]}
        user={user}
        onLogin={() => setAuth('login')}
        version={version}
        saved={saved}
        onSave={saveVehicle}
        onChanged={changed}
      />
    );
  else if (route === 'saved')
    content = <Saved version={version} saved={saved} onSave={saveVehicle} />;
  else if (isProtected)
    content = (
      <Dashboard
        key={route}
        user={user}
        view={route}
        version={version}
        onChanged={changed}
        notify={notify}
      />
    );
  else
    content = (
      <Explore
        version={version}
        saved={saved}
        onSave={user?.role === 'owner' ? undefined : saveVehicle}
      />
    );
  return (
    <>
      <a
        className="skip-link"
        href="#main"
        onClick={(event) => {
          event.preventDefault();
          const main = document.getElementById('main');
          main.focus();
          main.scrollIntoView({ block: 'start' });
        }}
      >
        Skip to content
      </a>
      <header className="site-header">
        <div className="header-inner">
          <a href="#explore" className="brand" aria-label="Wheels 2 Go home">
            <Brand />
          </a>
          <nav
            className={mobileNav ? 'nav open' : 'nav'}
            aria-label="Primary navigation"
            id="primary-navigation"
          >
            {nav.map(([value, label]) => (
              <a
                key={value}
                className={route === value ? 'active' : ''}
                href={`#${value}`}
                aria-current={route === value ? 'page' : undefined}
              >
                {label}
              </a>
            ))}
            {user && (
              <div className="mobile-account">
                <strong>{user.name}</strong>
                <small>{user.role === 'owner' ? 'Vehicle owner' : 'Customer'}</small>
              </div>
            )}
          </nav>
          <div className="header-actions">
            {user ? (
              <>
                <button
                  className="icon-button notifications-button"
                  aria-label={`Notifications, ${notifications.filter((x) => !x.seen).length} unread`}
                  onClick={() => setInbox(true)}
                >
                  <Icon name="bell" />
                  {notifications.some((x) => !x.seen) && <span className="notification-dot" />}
                </button>
                <div className="user-chip">
                  <span className="avatar small">{user.name.slice(0, 1)}</span>
                  <span>
                    {user.name}
                    <small>{user.role === 'owner' ? 'Vehicle owner' : 'Customer'}</small>
                  </span>
                </div>
                <button
                  className="icon-button"
                  onClick={logout}
                  disabled={actionBusy}
                  aria-label="Sign out"
                >
                  <Icon name="logout" />
                </button>
              </>
            ) : (
              <>
                <button className="text-button sign-in" onClick={() => setAuth('login')}>
                  Sign in
                </button>
                <button className="button primary small" onClick={() => setAuth('register')}>
                  Get started
                  <Icon name="right" size={15} />
                </button>
              </>
            )}
            <button
              className="icon-button mobile-menu"
              aria-label="Toggle navigation"
              aria-controls="primary-navigation"
              aria-expanded={mobileNav}
              onClick={() => setMobileNav((x) => !x)}
            >
              <Icon name={mobileNav ? 'close' : 'menu'} />
            </button>
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        {content}
      </main>
      <footer className="site-footer">
        <a href="#explore" className="brand" aria-label="Wheels 2 Go home">
          <Brand />
        </a>
        <p>A ride for every kind of journey.</p>
        <span>Built for the road ahead.</span>
      </footer>
      {toast && (
        <div
          className={`toast ${toast.error ? 'error' : ''}`}
          role={toast.error ? 'alert' : 'status'}
        >
          <Icon name={toast.error ? 'close' : 'success'} size={20} />
          <span>{toast.message}</span>
          <button
            className="icon-button"
            aria-label="Dismiss message"
            onClick={() => setToast(null)}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
      {inbox && (
        <Modal title="Notifications" onClose={() => setInbox(false)}>
          <div className="inbox-toolbar">
            <p className="muted">Booking updates, as they happen.</p>
            <button className="text-button" onClick={markRead}>
              Mark all read
            </button>
          </div>
          {notifications.length ? (
            <div className="notification-list">
              {notifications.map((item) => (
                <article key={item.id} className={item.seen ? '' : 'unread'}>
                  <Icon name="bell" size={18} />
                  <div>
                    <p>{item.message}</p>
                    <small>
                      {new Date(`${item.created_at.replace(' ', 'T')}Z`).toLocaleString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </small>
                    {item.booking_id && (
                      <a
                        href={user.role === 'owner' ? '#bookings' : '#rentals'}
                        onClick={() => setInbox(false)}
                      >
                        View bookings
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <Empty title="You’re all caught up" body="Booking status changes will appear here." />
          )}
        </Modal>
      )}
    </>
  );
}
