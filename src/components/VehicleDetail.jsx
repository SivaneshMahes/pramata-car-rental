import React, { useState } from 'react';
import { api, money, today, addDays, dateLabel } from '../api';
import { Icon, Field, ErrorBox, Empty, Skeleton, Rating, Modal, useLoad } from './UI';
import Calendar from './Calendar';
export default function VehicleDetail({ id, user, onLogin, version, saved, onSave, onChanged }) {
  const state = useLoad(`/vehicles/${id}`, version);
  const [draft] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem(`wheels-booking-${id}`) || '{}');
    } catch {
      return {};
    }
  });
  const [activeImage, setActiveImage] = useState(0),
    [start, setStart] = useState(typeof draft.start === 'string' ? draft.start : ''),
    [end, setEnd] = useState(typeof draft.end === 'string' ? draft.end : ''),
    [coupon, setCoupon] = useState(typeof draft.coupon === 'string' ? draft.coupon : ''),
    [quote, setQuote] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [confirmation, setConfirmation] = useState(null);
  const v = state.data;
  function changeDates(s, e) {
    setStart(s);
    setEnd(e);
    setQuote(null);
    setError('');
  }
  function selectDate(date) {
    if (!start || end || date <= start) changeDates(date, '');
    else changeDates(start, date);
  }
  async function check(event) {
    event.preventDefault();
    if (!user) {
      sessionStorage.setItem(`wheels-booking-${id}`, JSON.stringify({ start, end, coupon }));
      return onLogin();
    }
    setBusy(true);
    setError('');
    setQuote(null);
    try {
      setQuote(
        await api('/bookings/quote', {
          method: 'POST',
          body: { vehicle_id: v.id, start_date: start, end_date: end, coupon },
        }),
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function book() {
    setBusy(true);
    setError('');
    try {
      const b = await api('/bookings', {
        method: 'POST',
        body: {
          vehicle_id: v.id,
          start_date: start,
          end_date: end,
          coupon,
          expected_total: quote.total,
          expected_daily_price: quote.daily_price,
        },
      });
      sessionStorage.removeItem(`wheels-booking-${id}`);
      setConfirmation(b);
      setQuote(null);
      onChanged();
    } catch (err) {
      setQuote(null);
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  if (state.loading)
    return (
      <div className="page-wrap">
        <Skeleton cards={1} />
      </div>
    );
  if (state.error)
    return (
      <div className="page-wrap">
        <a href="#explore" className="back-link">
          Back to vehicles
        </a>
        <ErrorBox message={state.error} onRetry={state.retry} />
      </div>
    );
  return (
    <div className="page-wrap detail-page">
      <a href="#explore" className="back-link">
        <Icon name="left" size={17} />
        All vehicles
      </a>
      <div className="detail-title">
        <div>
          <div className="card-meta">
            <span>{v.type}</span>
            <Rating rating={v.rating} count={v.review_count} />
          </div>
          <h1>{v.name}</h1>
          <div className="location">
            <Icon name="pin" size={18} />
            {v.location}
            <span>Listed by {v.owner_name}</span>
          </div>
        </div>
        {user?.role !== 'owner' && (
          <button
            className="button secondary"
            onClick={() => onSave(v.id)}
            aria-pressed={saved.includes(v.id)}
          >
            <Icon name="heart" weight={saved.includes(v.id) ? 'fill' : 'regular'} />
            {saved.includes(v.id) ? 'Saved' : 'Save vehicle'}
          </button>
        )}
      </div>
      <div className="detail-layout">
        <div>
          <div className="detail-photo">
            <img
              src={v.images[activeImage] || v.images[0]}
              alt={`${v.name}, photo ${activeImage + 1}`}
            />
          </div>
          {v.images.length > 1 && (
            <div className="gallery-thumbs">
              {v.images.map((image, i) => (
                <button
                  key={image}
                  className={i === activeImage ? 'active' : ''}
                  aria-label={`View photo ${i + 1}`}
                  aria-pressed={i === activeImage}
                  onClick={() => setActiveImage(i)}
                >
                  <img src={image} alt="" />
                </button>
              ))}
            </div>
          )}
          {(v.images[activeImage] || v.images[0]).startsWith('/images/') && (
            <p className="fine-print photo-note">
              Demo photo: an example of this vehicle model.{' '}
              <a href="/image-credits.html" target="_blank" rel="noreferrer">
                Photo credits
              </a>
            </p>
          )}
          <section className="detail-section">
            <h2>A little about your ride</h2>
            <p className="description">{v.description}</p>
            <div className="feature-list">
              {v.features.map((x) => (
                <span key={x}>
                  <Icon name="check" size={17} />
                  {x}
                </span>
              ))}
            </div>
          </section>
          <section className="detail-section">
            <h2>Your host</h2>
            <div className="host">
              <span className="avatar">{v.owner_name.slice(0, 1)}</span>
              <div>
                <strong>{v.owner_name}</strong>
                <p>Vehicle owner in {v.location}</p>
              </div>
            </div>
            <p className="fine-print">
              Bring your driving licence to pickup. Fuel and pickup arrangements are confirmed with
              the owner after approval.
            </p>
          </section>
          <section className="detail-section">
            <h2>Reviews from the road</h2>
            {v.reviews.length ? (
              <>
                <Rating rating={v.rating} count={v.review_count} />
                <div className="reviews">
                  {v.reviews.map((review) => (
                    <article key={review.id} className="review">
                      <div className="review-top">
                        <strong>{review.customer_name}</strong>
                        <span>
                          <Icon name="star" size={15} weight="fill" />
                          {review.rating}/5
                        </span>
                      </div>
                      <p>{review.body}</p>
                      <small>{dateLabel(review.created_at.slice(0, 10))} · Completed rental</small>
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <p className="muted">
                No reviews yet. Customers can leave a review after returning the vehicle.
              </p>
            )}
          </section>
        </div>
        <aside className="booking-panel">
          <div className="booking-price">
            <strong>{money(v.daily_price)}</strong>
            <span>/ day</span>
            <span className={`availability ${v.available ? '' : 'off'}`}>
              {v.available ? 'Available' : 'Unavailable'}
            </span>
          </div>
          <h2>Make it your next ride</h2>
          <p className="muted">Choose your dates for an exact price.</p>
          {user?.role === 'owner' ? (
            <div className="info-box">
              You’re signed in as a vehicle owner. Use a customer account to book a rental.
            </div>
          ) : (
            <form onSubmit={check} className="form-stack">
              <div className="form-row">
                <Field label="Pickup date">
                  <input
                    type="date"
                    value={start}
                    min={today()}
                    required
                    disabled={busy}
                    onChange={(e) => changeDates(e.target.value, end)}
                  />
                </Field>
                <Field label="Return date">
                  <input
                    type="date"
                    value={end}
                    min={start ? addDays(start, 1) : addDays(today(), 1)}
                    required
                    disabled={busy}
                    onChange={(e) => changeDates(start, e.target.value)}
                  />
                </Field>
              </div>
              <Field label="Coupon code (optional)">
                <input
                  value={coupon}
                  maxLength={32}
                  placeholder="Try FIRST10"
                  disabled={busy}
                  onChange={(e) => {
                    setCoupon(e.target.value.toUpperCase());
                    setQuote(null);
                    setError('');
                  }}
                />
              </Field>
              <ErrorBox message={error} />
              {quote ? (
                <div className="price-breakdown">
                  <div>
                    <span>
                      {money(quote.daily_price)} × {quote.days} {quote.days === 1 ? 'day' : 'days'}
                    </span>
                    <span>{money(quote.subtotal)}</span>
                  </div>
                  {quote.discount > 0 && (
                    <div>
                      <span>Discount ({quote.coupon})</span>
                      <span>−{money(quote.discount)}</span>
                    </div>
                  )}
                  <div className="total">
                    <strong>Total rental cost</strong>
                    <strong>{money(quote.total)}</strong>
                  </div>
                  <div className="available-message">
                    <Icon name="success" size={17} />
                    Your dates are available
                  </div>
                  <button
                    type="button"
                    className="button primary full"
                    disabled={busy}
                    onClick={book}
                  >
                    {busy ? 'Requesting…' : 'Request rental'}
                    <Icon name="right" size={18} />
                  </button>
                </div>
              ) : (
                <button
                  className="button primary full"
                  formNoValidate={!user}
                  disabled={!v.available || busy}
                >
                  {busy
                    ? 'Checking…'
                    : !v.available
                      ? 'Currently unavailable'
                      : user
                        ? 'Check availability'
                        : 'Sign in to book'}
                </button>
              )}
              <p className="fine-print">
                Pickup day counts; return day doesn’t. Your request reserves the dates while the
                owner reviews it. No payment is collected here.
              </p>
            </form>
          )}
          <Calendar
            reservations={v.reservations}
            start={start}
            end={end}
            onSelect={selectDate}
            unavailable={!v.available || busy || user?.role === 'owner'}
          />
        </aside>
      </div>
      {confirmation && (
        <Modal title="Your rental request is in" onClose={() => setConfirmation(null)}>
          <div className="confirmation">
            <Icon name="success" size={48} />
            <h3>{confirmation.snapshot.vehicle}</h3>
            <p>Booking W2G-{String(confirmation.id).padStart(5, '0')}</p>
            <p>
              {dateLabel(confirmation.start_date)} to {dateLabel(confirmation.end_date)}
              <br />
              {confirmation.days} days · {money(confirmation.total)}
            </p>
            <div className="info-box">
              Your dates are reserved. {confirmation.snapshot.owner} will review the request, and
              you’ll receive a notification when its status changes.
            </div>
            <a
              className="button primary full"
              href="#rentals"
              onClick={() => setConfirmation(null)}
            >
              View my rentals
            </a>
            <a
              className="button secondary full"
              href={`/api/bookings/${confirmation.id}/invoice`}
              download
            >
              <Icon name="download" />
              Download invoice
            </a>
          </div>
        </Modal>
      )}
    </div>
  );
}
