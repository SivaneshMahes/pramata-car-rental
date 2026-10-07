import React, { useState } from 'react';
import { api, money, today, dateLabel, statusLabel } from '../api';
import { Icon, Modal, Field, ErrorBox, Empty, Skeleton, useLoad } from './UI';
import VehicleCard from './VehicleCard';
import VehicleForm from './VehicleForm';
function Stats({ user, version }) {
  const state = useLoad('/dashboard', version),
    s = state.data;
  if (state.error) return <ErrorBox message={state.error} onRetry={state.retry} />;
  const metrics =
    user.role === 'owner'
      ? [
          ['Listed vehicles', s?.vehicles],
          ['On the road', s?.active],
          ['Completed rental revenue', s ? money(s.revenue) : null],
          ['Average rating', s?.review_count ? `${s.rating.toFixed(1)} / 5` : 'No reviews'],
        ]
      : [
          ['Upcoming rentals', s?.upcoming],
          ['On the road', s?.active],
          ['Completed trips', s?.completed],
        ];
  return (
    <div className="stats">
      {metrics.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{state.loading ? <span className="stat-skeleton" /> : value}</strong>
        </div>
      ))}
    </div>
  );
}
function ReviewForm({ booking, onClose, onSaved }) {
  const [rating, setRating] = useState(booking.review_rating || 5),
    [body, setBody] = useState(booking.review_body || ''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/reviews', { method: 'POST', body: { booking_id: booking.id, rating, body } });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={booking.review_id ? 'Edit your review' : 'How was your ride?'} onClose={onClose}>
      <p className="muted">
        {booking.snapshot.vehicle} · Booking #{booking.id}
      </p>
      <form className="form-stack" onSubmit={save}>
        <fieldset className="rating-picker">
          <legend>Vehicle rating</legend>
          {[1, 2, 3, 4, 5].map((value) => (
            <label key={value}>
              <input
                type="radio"
                name="rating"
                value={value}
                checked={rating === value}
                onChange={() => setRating(value)}
              />
              <Icon name="star" size={30} weight={value <= rating ? 'fill' : 'regular'} />
              <span className="sr-only">
                {value} {value === 1 ? 'star' : 'stars'}
              </span>
            </label>
          ))}
          <span>{rating}/5</span>
        </fieldset>
        <Field label="Your review" hint="Tell future renters about your experience.">
          <textarea
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            minLength={10}
            maxLength={2000}
          />
        </Field>
        <ErrorBox message={error} />
        <button className="button primary full" disabled={busy}>
          {busy ? 'Saving…' : 'Save review'}
        </button>
      </form>
    </Modal>
  );
}
export default function Dashboard({ user, view, version, onChanged, notify }) {
  const owner = user.role === 'owner';
  const vehicles = owner && view === 'owner';
  const state = useLoad(vehicles ? '/owner/vehicles' : '/bookings', version);
  const [form, setForm] = useState(null),
    [review, setReview] = useState(null),
    [confirm, setConfirm] = useState(null),
    [tab, setTab] = useState('all'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function mutate(path, method, body, message) {
    setBusy(true);
    setError('');
    try {
      await api(path, { method, body });
      onChanged();
      notify(message);
      setConfirm(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  const tabs = owner
    ? [
        ['all', 'All bookings'],
        ['requested', 'Requests'],
        ['approved', 'Approved'],
        ['handed_over', 'On the road'],
        ['returned', 'Completed'],
        ['closed', 'Closed'],
      ]
    : [
        ['all', 'All rentals'],
        ['upcoming', 'Upcoming'],
        ['handed_over', 'On the road'],
        ['history', 'History'],
      ];
  function matches(b) {
    if (tab === 'all') return true;
    if (tab === 'upcoming')
      return ['requested', 'approved'].includes(b.status) && b.end_date > today();
    if (tab === 'history')
      return (
        ['returned', 'cancelled', 'rejected'].includes(b.status) ||
        (['requested', 'approved'].includes(b.status) && b.end_date <= today())
      );
    if (tab === 'closed') return ['cancelled', 'rejected'].includes(b.status);
    return b.status === tab;
  }
  const filtered = state.data?.filter(vehicles ? () => true : matches) || [];
  return (
    <div className="page-wrap dashboard">
      <div className="page-heading">
        <div>
          <p className="welcome">
            {owner ? 'Your rental business' : 'Your journeys'}, {user.name.split(' ')[0]}
          </p>
          <h1>{vehicles ? 'Your fleet' : owner ? 'Rental bookings' : 'My rentals'}</h1>
          <p className="muted">
            {vehicles
              ? 'Keep your vehicles ready for their next journey.'
              : owner
                ? 'Review requests and manage every step of a rental.'
                : 'Everything you need for your next trip, and the ones behind you.'}
          </p>
        </div>
        {vehicles && (
          <button className="button primary" onClick={() => setForm({})}>
            <Icon name="plus" />
            List a vehicle
          </button>
        )}
      </div>
      <Stats user={user} version={version} />
      {!vehicles && (
        <div className="dashboard-tabs">
          {tabs.map(([value, label]) => (
            <button
              key={value}
              className={tab === value ? 'active' : ''}
              onClick={() => setTab(value)}
            >
              {label}
              {value === 'requested' && state.data?.some((x) => x.status === 'requested') && (
                <span className="count">
                  {state.data.filter((x) => x.status === 'requested').length}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      <ErrorBox message={error} />
      <ErrorBox message={state.error} onRetry={state.retry} />
      {state.loading ? (
        <Skeleton />
      ) : state.error ? null : !filtered.length ? (
        <Empty
          title={vehicles ? 'Your fleet starts here' : 'No rentals in this view'}
          body={
            vehicles
              ? 'Add a vehicle with a few photos and clear details.'
              : 'Your rentals will appear here as you make and manage bookings.'
          }
          action={
            vehicles ? (
              <button className="button primary" onClick={() => setForm({})}>
                List a vehicle
              </button>
            ) : !owner ? (
              <a className="button primary" href="#explore">
                Find a ride
              </a>
            ) : undefined
          }
        />
      ) : vehicles ? (
        <div className="vehicle-grid owner-grid">
          {filtered.map((vehicle) => (
            <VehicleCard
              key={vehicle.id}
              vehicle={vehicle}
              manage
              busy={busy}
              onEdit={setForm}
              onToggle={(v) =>
                mutate(
                  `/vehicles/${v.id}`,
                  'PATCH',
                  { available: !v.available },
                  v.available ? 'Listing paused.' : 'Listing is available.',
                )
              }
              onDelete={(v) => {
                setError('');
                setConfirm({ kind: 'delete', vehicle: v });
              }}
            />
          ))}
        </div>
      ) : (
        <div className="booking-list">
          {filtered.map((b) => (
            <article key={b.id} className="booking-row">
              <a
                href={`#vehicle/${b.vehicle_id}`}
                className="booking-thumbnail"
                aria-label={`View ${b.snapshot.vehicle}`}
              >
                <img src={b.images[0]} alt="" />
              </a>
              <div className="booking-main">
                <div className="booking-top">
                  <span className={`status status-${b.status}`}>{statusLabel(b.status)}</span>
                  <small>W2G-{String(b.id).padStart(5, '0')}</small>
                </div>
                <h3>{b.snapshot.vehicle}</h3>
                <p className="booking-dates">
                  <Icon name="calendar" size={16} />
                  {dateLabel(b.start_date)} to {dateLabel(b.end_date)}
                </p>
                <p className="muted">
                  {b.days} {b.days === 1 ? 'day' : 'days'} · {b.snapshot.location}
                  {owner ? ` · ${b.customer_name}` : ` · ${b.snapshot.owner}`}
                </p>
                {owner && (
                  <a className="customer-email" href={`mailto:${b.customer_email}`}>
                    {b.customer_email}
                  </a>
                )}
                {b.archived === 1 && (
                  <p className="fine-print">
                    This vehicle is no longer listed. Your rental record is preserved.
                  </p>
                )}
                {['requested', 'approved'].includes(b.status) && b.end_date <= today() && (
                  <p className="fine-print">
                    The rental dates have passed.
                    {owner && b.status === 'requested' ? ' Decline this expired request.' : ''}
                  </p>
                )}
              </div>
              <div className="booking-actions">
                <strong>{money(b.total)}</strong>
                <span className="fine-print">Total rental cost</span>
                <a
                  href={`/api/bookings/${b.id}/invoice`}
                  download
                  className="button secondary small"
                >
                  <Icon name="download" size={16} />
                  Invoice
                </a>
                {owner && b.status === 'requested' && (
                  <>
                    <button
                      className="button primary small"
                      disabled={busy || b.end_date <= today()}
                      onClick={() =>
                        mutate(
                          `/bookings/${b.id}/status`,
                          'PATCH',
                          { status: 'approved' },
                          'Rental approved.',
                        )
                      }
                    >
                      Approve
                    </button>
                    <button
                      className="text-button danger"
                      disabled={busy}
                      onClick={() => {
                        setError('');
                        setConfirm({ kind: 'status', booking: b, status: 'rejected' });
                      }}
                    >
                      Decline
                    </button>
                  </>
                )}
                {owner && b.status === 'approved' && (
                  <button
                    className="button primary small"
                    disabled={busy || b.start_date > today() || b.end_date <= today()}
                    title={b.start_date > today() ? 'Available on pickup day' : undefined}
                    onClick={() => {
                      setError('');
                      setConfirm({ kind: 'status', booking: b, status: 'handed_over' });
                    }}
                  >
                    Mark handed over
                  </button>
                )}
                {owner && b.status === 'approved' && b.end_date <= today() && (
                  <button
                    className="text-button danger"
                    disabled={busy}
                    onClick={() => {
                      setError('');
                      setConfirm({ kind: 'status', booking: b, status: 'rejected' });
                    }}
                  >
                    Close missed pickup
                  </button>
                )}
                {owner && b.status === 'handed_over' && (
                  <button
                    className="button primary small"
                    disabled={busy}
                    onClick={() => {
                      setError('');
                      setConfirm({ kind: 'status', booking: b, status: 'returned' });
                    }}
                  >
                    Mark returned
                  </button>
                )}
                {!owner &&
                  ['requested', 'approved'].includes(b.status) &&
                  b.start_date > today() && (
                    <button
                      className="text-button danger"
                      disabled={busy}
                      onClick={() => {
                        setError('');
                        setConfirm({ kind: 'status', booking: b, status: 'cancelled' });
                      }}
                    >
                      Cancel rental
                    </button>
                  )}
                {!owner && b.status === 'returned' && (
                  <button className="button primary small" onClick={() => setReview(b)}>
                    {b.review_id ? 'Edit review' : 'Leave a review'}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {form && (
        <VehicleForm
          vehicle={form.id ? form : null}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            onChanged();
            notify(form.id ? 'Vehicle updated.' : 'Vehicle listed.');
          }}
        />
      )}
      {review && (
        <ReviewForm
          booking={review}
          onClose={() => setReview(null)}
          onSaved={() => {
            setReview(null);
            onChanged();
            notify('Your review has been saved.');
          }}
        />
      )}
      {confirm && (
        <Modal
          title={
            confirm.kind === 'delete'
              ? 'Delete this listing?'
              : `${{ rejected: 'Decline this request', cancelled: 'Cancel this rental', handed_over: 'Confirm vehicle handover', returned: 'Confirm vehicle return' }[confirm.status]}?`
          }
          onClose={busy ? () => {} : () => setConfirm(null)}
        >
          <p>
            {confirm.kind === 'delete'
              ? `${confirm.vehicle.name} will be removed from discovery. Listings with active bookings cannot be deleted. Past rentals and invoices will be preserved.`
              : confirm.status === 'returned'
                ? 'Confirm that the vehicle has been returned. The customer can then leave a review.'
                : confirm.status === 'handed_over'
                  ? 'Confirm that you have checked the customer’s licence and handed over the vehicle.'
                  : 'This releases the reserved dates. This action cannot be undone.'}
          </p>
          <ErrorBox message={error} />
          <div className="modal-actions">
            <button className="button secondary" disabled={busy} onClick={() => setConfirm(null)}>
              Go back
            </button>
            <button
              className="button primary"
              disabled={busy}
              onClick={() =>
                confirm.kind === 'delete'
                  ? mutate(
                      `/vehicles/${confirm.vehicle.id}`,
                      'DELETE',
                      undefined,
                      'Vehicle listing deleted.',
                    )
                  : mutate(
                      `/bookings/${confirm.booking.id}/status`,
                      'PATCH',
                      { status: confirm.status },
                      'Booking updated.',
                    )
              }
            >
              {busy ? 'Updating…' : 'Confirm'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
