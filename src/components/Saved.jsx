import React from 'react';
import { useLoad, ErrorBox, Skeleton, Empty } from './UI';
import VehicleCard from './VehicleCard';
export default function Saved({ version, saved, onSave }) {
  const state = useLoad('/favorites', version);
  return (
    <div className="page-wrap">
      <div className="page-heading">
        <div>
          <h1>Saved for the next trip</h1>
          <p className="muted">Your shortlist, ready whenever you are.</p>
        </div>
      </div>
      <ErrorBox message={state.error} onRetry={state.retry} />
      {state.loading ? (
        <Skeleton />
      ) : state.data?.length ? (
        <div className="vehicle-grid owner-grid">
          {state.data.map((vehicle) => (
            <VehicleCard
              key={vehicle.id}
              vehicle={vehicle}
              saved={saved.includes(vehicle.id)}
              onSave={onSave}
            />
          ))}
        </div>
      ) : (
        !state.error && (
          <Empty
            title="A little inspiration for later"
            body="Tap the heart on a vehicle to keep it in your shortlist."
            action={
              <a href="#explore" className="button primary">
                Explore vehicles
              </a>
            }
          />
        )
      )}
    </div>
  );
}
