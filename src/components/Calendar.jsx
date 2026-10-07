import React, { useState } from 'react';
import { today } from '../api';
import { Icon } from './UI';
export default function Calendar({ reservations, start, end, onSelect, unavailable }) {
  const [month, setMonth] = useState(() =>
    new Date(`${start || today()}T00:00:00Z`).toISOString().slice(0, 7),
  );
  const first = new Date(`${month}-01T00:00:00Z`);
  const count = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const offset = (first.getUTCDay() + 6) % 7;
  function move(by) {
    const date = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + by, 1));
    setMonth(date.toISOString().slice(0, 7));
  }
  return (
    <div className="calendar">
      <div className="calendar-header">
        <button className="icon-button" aria-label="Previous month" onClick={() => move(-1)}>
          <Icon name="left" size={18} />
        </button>
        <strong>
          {first.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
        </strong>
        <button className="icon-button" aria-label="Next month" onClick={() => move(1)}>
          <Icon name="right" size={18} />
        </button>
      </div>
      <div className="calendar-grid">
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((day) => (
          <span className="weekday" key={day}>
            {day}
          </span>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <span key={`gap-${i}`} />
        ))}
        {Array.from({ length: count }, (_, i) => {
          const date = `${month}-${String(i + 1).padStart(2, '0')}`;
          const booked = reservations.some((x) => date >= x.start_date && date < x.end_date);
          const past = date < today();
          const selected = date === start || date === end;
          const between = start && end && date > start && date < end;
          return (
            <button
              type="button"
              key={date}
              className={`calendar-day ${booked ? 'reserved' : ''} ${selected ? 'selected' : ''} ${between ? 'between' : ''}`}
              disabled={past || unavailable}
              aria-label={`${date}${booked ? ' reserved; can be a return boundary' : ''}`}
              aria-pressed={!!selected}
              onClick={() => onSelect(date)}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <div className="calendar-legend">
        <span>
          <i className="reserved-key" />
          Reserved
        </span>
        <span>
          <i className="selected-key" />
          Your dates
        </span>
      </div>
      <p className="fine-print">
        Choose pickup, then return. A reserved date may be used as your return date; availability is
        checked for the whole range.
      </p>
    </div>
  );
}
