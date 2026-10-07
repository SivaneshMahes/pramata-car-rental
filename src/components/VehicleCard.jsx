import React from 'react';
import { Icon, Rating } from './UI';
import { money } from '../api';
export default function VehicleCard({
  vehicle,
  saved,
  onSave,
  manage,
  onEdit,
  onToggle,
  onDelete,
  busy,
}) {
  return (
    <article className="vehicle-card">
      <div className="vehicle-photo">
        <a href={`#vehicle/${vehicle.id}`} tabIndex={-1} aria-hidden="true">
          <img src={vehicle.images[0]} alt="" loading="lazy" />
        </a>
        {!manage && onSave && (
          <button
            className={`save-button ${saved ? 'saved' : ''}`}
            aria-label={`${saved ? 'Unsave' : 'Save'} ${vehicle.name}`}
            aria-pressed={saved}
            onClick={() => onSave(vehicle.id)}
          >
            <Icon name="heart" weight={saved ? 'fill' : 'regular'} />
          </button>
        )}
      </div>
      <div className="vehicle-content">
        <div className="card-meta">
          <span>{vehicle.type}</span>
          <Rating rating={vehicle.rating} count={vehicle.review_count} />
        </div>
        <h3>
          <a href={`#vehicle/${vehicle.id}`}>{vehicle.name}</a>
        </h3>
        <p className="vehicle-summary">{vehicle.summary}</p>
        <div className="location">
          <Icon name="pin" size={16} />
          {vehicle.location}
          <span className="owner-name">by {vehicle.owner_name}</span>
        </div>
        <div className="card-bottom">
          <span>
            <strong>{money(vehicle.daily_price)}</strong>
            <span className="muted"> / day</span>
          </span>
          <span className={`availability ${vehicle.available ? '' : 'off'}`}>
            {vehicle.available ? 'Available' : 'Unavailable'}
          </span>
        </div>
        {manage && (
          <div className="management-actions">
            <button
              className="button secondary small"
              disabled={busy}
              onClick={() => onEdit(vehicle)}
            >
              <Icon name="edit" size={16} />
              Edit
            </button>
            <button className="text-button" disabled={busy} onClick={() => onToggle(vehicle)}>
              {vehicle.available ? 'Pause listing' : 'Make available'}
            </button>
            <button
              className="icon-button danger"
              aria-label={`Delete ${vehicle.name}`}
              disabled={busy}
              onClick={() => onDelete(vehicle)}
            >
              <Icon name="trash" size={18} />
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
