import React, { useState } from 'react';
import { api } from '../api';
import { Modal, Field, Select, ErrorBox, Icon } from './UI';
export default function VehicleForm({ vehicle, onClose, onSaved }) {
  const [images, setImages] = useState(vehicle?.images || []),
    [available, setAvailable] = useState(vehicle ? vehicle.available : true),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState('');
  async function upload(event) {
    const files = [...event.target.files];
    event.target.value = '';
    if (!files.length) return;
    if (images.length + files.length > 8) {
      setError('Keep up to 8 images per vehicle.');
      return;
    }
    if (files.some((file) => file.size > 5 * 1024 * 1024)) {
      setError('Each image must be 5 MB or smaller.');
      return;
    }
    setUploading(true);
    setError('');
    const data = new FormData();
    files.forEach((file) => data.append('images', file));
    try {
      const result = await api('/uploads', { method: 'POST', body: data });
      setImages((old) => [...old, ...result.images]);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }
  async function save(event) {
    event.preventDefault();
    setError('');
    if (!images.length) {
      setError('Upload at least one vehicle image.');
      return;
    }
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const features = data.features
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    setBusy(true);
    try {
      await api(vehicle ? `/vehicles/${vehicle.id}` : '/vehicles', {
        method: vehicle ? 'PATCH' : 'POST',
        body: { ...data, features, images, available },
      });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={vehicle ? 'Edit your vehicle' : 'List a vehicle'}
      onClose={busy || uploading ? () => {} : onClose}
      wide
    >
      <p className="muted">Clear details help customers find the right ride.</p>
      <form onSubmit={save} className="form-stack">
        <div className="form-row">
          <Field label="Vehicle name / model">
            <input
              name="name"
              required
              minLength={2}
              maxLength={100}
              defaultValue={vehicle?.name}
              placeholder="e.g. Hyundai Creta"
            />
          </Field>
          <Field label="Vehicle type">
            <Select name="type" defaultValue={vehicle?.type || 'Car'}>
              {['Car', 'SUV', 'Bike', 'Van'].map((type) => (
                <option key={type}>{type}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Short description" hint="A brief summary shown on the vehicle card.">
          <input
            name="summary"
            required
            minLength={5}
            maxLength={160}
            defaultValue={vehicle?.summary}
            placeholder="A comfortable SUV for weekend getaways."
          />
        </Field>
        <Field label="Detailed description">
          <textarea
            name="description"
            required
            minLength={20}
            maxLength={4000}
            rows={4}
            defaultValue={vehicle?.description}
            placeholder="Describe your vehicle, pickup arrangements and any important rental conditions."
          />
        </Field>
        <div className="form-row">
          <Field label="Registration number">
            <input
              name="registration"
              required
              minLength={4}
              maxLength={25}
              defaultValue={vehicle?.registration}
              placeholder="TN09AB1234"
            />
          </Field>
          <Field label="Daily rental price (₹)">
            <input
              name="daily_price"
              type="number"
              required
              min="1"
              max="1000000"
              step="0.01"
              defaultValue={vehicle ? vehicle.daily_price / 100 : undefined}
              placeholder="1800"
            />
          </Field>
        </div>
        <Field label="Pickup location">
          <input
            name="location"
            required
            minLength={2}
            maxLength={80}
            defaultValue={vehicle?.location}
            placeholder="Chennai"
          />
        </Field>
        <Field label="Features" hint="Separate features with commas. Up to 20 features.">
          <textarea
            name="features"
            maxLength={1200}
            rows={2}
            defaultValue={vehicle?.features.join(', ')}
            placeholder="Automatic transmission, Air conditioning, GPS, 5 seats, Bluetooth"
          />
        </Field>
        <div className="field">
          <span>Vehicle images ({images.length}/8)</span>
          <p className="fine-print">
            JPEG, PNG or WebP. Maximum 5 MB per image. The first image is your cover.
          </p>
          <div className="upload-gallery">
            {images.map((image, index) => (
              <div key={image}>
                <img src={image} alt={`Vehicle photo ${index + 1}`} />
                <button
                  className="icon-button"
                  type="button"
                  disabled={uploading || busy}
                  aria-label={`Remove photo ${index + 1}`}
                  onClick={() => setImages((old) => old.filter((x) => x !== image))}
                >
                  <Icon name="close" size={15} />
                </button>
                {index === 0 && <span>Cover</span>}
              </div>
            ))}
          </div>
          <label className="upload-button">
            <Icon name="upload" />
            {uploading ? 'Uploading images…' : 'Choose images'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              disabled={uploading || busy || images.length >= 8}
              onChange={upload}
            />
          </label>
        </div>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={available}
            onChange={(e) => setAvailable(e.target.checked)}
          />
          Available for new rentals
        </label>
        <ErrorBox message={error} />
        <div className="modal-actions">
          <button
            type="button"
            className="button secondary"
            disabled={busy || uploading}
            onClick={onClose}
          >
            Cancel
          </button>
          <button className="button primary" disabled={busy || uploading}>
            {busy ? 'Saving…' : vehicle ? 'Save changes' : 'List vehicle'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
