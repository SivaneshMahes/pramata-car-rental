import React, { useState } from 'react';
import VehicleCard from './VehicleCard';
import { Icon, Field, Select, ErrorBox, Empty, Skeleton, useLoad } from './UI';
import { today } from '../api';
const defaults = {
  q: '',
  type: '',
  location: '',
  owner: '',
  min: '',
  max: '',
  start: '',
  end: '',
  sort: 'recommended',
};
export default function Explore({ version, saved, onSave }) {
  const [draft, setDraft] = useState(defaults),
    [filters, setFilters] = useState(defaults),
    [showFilters, setShowFilters] = useState(false);
  const metadata = useLoad('/filters', version);
  const query = new URLSearchParams(Object.entries(filters).filter(([, v]) => v !== ''));
  const result = useLoad(`/vehicles?${query}`, version);
  const active = Object.entries(filters).filter(([key, value]) => value && key !== 'sort').length;
  function change(key, value) {
    setDraft((old) => ({ ...old, [key]: value }));
  }
  function category(value) {
    setDraft((old) => ({ ...old, type: value }));
    setFilters((old) => ({ ...old, type: value }));
  }
  function reset() {
    setDraft(defaults);
    setFilters(defaults);
  }
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="hero-intro">
            <Icon name="road" size={18} />
            Your plans. Your pace.
          </span>
          <h1>
            A good journey
            <br />
            starts here.
          </h1>
          <p>Find your next ride, from everyday drives to weekend escapes.</p>
          <a
            href="#fleet"
            className="button primary"
            onClick={(event) => {
              event.preventDefault();
              document.getElementById('fleet').scrollIntoView({
                behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
                  ? 'auto'
                  : 'smooth',
              });
            }}
          >
            Explore vehicles
            <Icon name="arrow" size={18} />
          </a>
        </div>
        <div className="hero-image">
          <img src="/images/hero.jpg" alt="A Porsche driving along the road" fetchPriority="high" />
          <div className="hero-caption">
            <Icon name="key" size={21} />
            <span>
              Pick a ride.
              <br />
              <strong>Make it a getaway.</strong>
            </span>
          </div>
        </div>
      </section>
      <div className="service-strip">
        <span>
          <Icon name="calendar" />
          Flexible rental dates
        </span>
        <span>
          <Icon name="shield" />
          Clear prices, before you book
        </span>
        <span>
          <Icon name="key" />
          Rent from local owners
        </span>
      </div>
      <section id="fleet" className="fleet">
        <div className="section-heading">
          <div>
            <h2>Find your kind of ride</h2>
            <p>Choose the vehicle that fits your journey.</p>
          </div>
        </div>
        <div className="catalog-layout">
          <aside className={`filter-panel ${showFilters ? 'expanded' : ''}`}>
            <div className="filter-heading">
              <h3>
                <Icon name="filter" size={18} />
                Refine your search
              </h3>
              <button className="text-button" onClick={reset}>
                Reset
              </button>
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setFilters({ ...draft });
                setShowFilters(false);
              }}
              className="form-stack"
            >
              <Field label="Search vehicle">
                <div className="input-icon">
                  <Icon name="search" size={18} />
                  <input
                    value={draft.q}
                    onChange={(e) => change('q', e.target.value)}
                    placeholder="Name or model"
                    maxLength={100}
                  />
                </div>
              </Field>
              <Field label="Pickup location">
                <Select value={draft.location} onChange={(e) => change('location', e.target.value)}>
                  <option value="">All locations</option>
                  {metadata.data?.locations.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Vehicle type">
                <Select value={draft.type} onChange={(e) => change('type', e.target.value)}>
                  <option value="">All vehicles</option>
                  {['Car', 'SUV', 'Bike', 'Van'].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </Select>
              </Field>
              <div className="field">
                <span>Price per day (₹)</span>
                <div className="form-row">
                  <input
                    aria-label="Minimum price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={draft.min}
                    onChange={(e) => change('min', e.target.value)}
                    placeholder="Min"
                  />
                  <input
                    aria-label="Maximum price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={draft.max}
                    onChange={(e) => change('max', e.target.value)}
                    placeholder="Max"
                  />
                </div>
              </div>
              <Field label="Pickup date">
                <input
                  type="date"
                  min={today()}
                  value={draft.start}
                  onChange={(e) => change('start', e.target.value)}
                />
              </Field>
              <Field label="Return date">
                <input
                  type="date"
                  min={draft.start || today()}
                  value={draft.end}
                  onChange={(e) => change('end', e.target.value)}
                />
              </Field>
              <Field label="Vehicle owner">
                <Select value={draft.owner} onChange={(e) => change('owner', e.target.value)}>
                  <option value="">All owners</option>
                  {metadata.data?.owners.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <ErrorBox message={metadata.error} onRetry={metadata.retry} />
              <button className="button primary full">
                Apply filters{active > 0 && ` (${active})`}
              </button>
            </form>
          </aside>
          <div className="catalog">
            <div className="catalog-toolbar">
              <div className="type-tabs" role="group" aria-label="Quick vehicle type filters">
                {[
                  ['', 'All vehicles'],
                  ['Car', 'Cars'],
                  ['SUV', 'SUVs'],
                  ['Bike', 'Bikes'],
                  ['Van', 'Vans'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    className={filters.type === value ? 'active' : ''}
                    aria-pressed={filters.type === value}
                    onClick={() => category(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label className="sort-select">
                <span className="sr-only">Sort vehicles</span>
                <Select
                  value={filters.sort}
                  onChange={(e) => {
                    change('sort', e.target.value);
                    setFilters((old) => ({ ...old, sort: e.target.value }));
                  }}
                >
                  <option value="recommended">Recommended</option>
                  <option value="price_asc">Price: low to high</option>
                  <option value="price_desc">Price: high to low</option>
                  <option value="newest">Recently listed</option>
                </Select>
              </label>
            </div>
            <div className="results-line">
              <span>
                {result.loading
                  ? 'Finding your next ride…'
                  : `${result.data?.length || 0} vehicles${active ? ' matching your search' : ' to make your own'}`}
              </span>
              <button
                className="button secondary small mobile-filters"
                onClick={() => setShowFilters((x) => !x)}
              >
                <Icon name="filter" size={16} />
                {showFilters ? 'Hide filters' : 'Filters'}
              </button>
              {active > 0 && (
                <button className="text-button" onClick={reset}>
                  Clear filters
                </button>
              )}
            </div>
            <ErrorBox message={result.error} onRetry={result.retry} />
            {result.loading ? (
              <Skeleton />
            ) : result.data?.length ? (
              <div className="vehicle-grid">
                {result.data.map((vehicle) => (
                  <VehicleCard
                    key={vehicle.id}
                    vehicle={vehicle}
                    saved={saved.includes(vehicle.id)}
                    onSave={onSave}
                  />
                ))}
              </div>
            ) : (
              !result.error && (
                <Empty
                  title="No rides match just yet"
                  body="Try another location, date range or price. There may be a better match nearby."
                  action={
                    <button className="button secondary" onClick={reset}>
                      Clear filters
                    </button>
                  }
                />
              )
            )}
            <div className="catalog-note">
              <Icon name="calendar" size={20} />
              <p>
                Planning ahead? Choose your dates to see vehicles available for your entire trip.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
