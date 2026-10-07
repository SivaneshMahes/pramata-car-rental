import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  ArrowClockwise,
  MapPin,
  Star,
  Car,
  Heart,
  ArrowUpRight,
  Motorcycle,
  Van,
  Bell,
  Plus,
  CaretRight,
  Check,
  CalendarBlank,
  SignOut,
  List,
  MagnifyingGlass,
  SlidersHorizontal,
  ShieldCheck,
  Key,
  RoadHorizon,
  CaretLeft,
  UploadSimple,
  Trash,
  PencilSimple,
  DownloadSimple,
  CheckCircle,
  CaretDown,
  Eye,
  EyeSlash,
  UserCircle,
} from '@phosphor-icons/react';
import { api } from '../api';
const icons = {
  close: X,
  retry: ArrowClockwise,
  pin: MapPin,
  star: Star,
  car: Car,
  heart: Heart,
  arrow: ArrowUpRight,
  bike: Motorcycle,
  van: Van,
  bell: Bell,
  plus: Plus,
  right: CaretRight,
  check: Check,
  calendar: CalendarBlank,
  logout: SignOut,
  menu: List,
  search: MagnifyingGlass,
  filter: SlidersHorizontal,
  shield: ShieldCheck,
  key: Key,
  road: RoadHorizon,
  left: CaretLeft,
  upload: UploadSimple,
  trash: Trash,
  edit: PencilSimple,
  download: DownloadSimple,
  success: CheckCircle,
  down: CaretDown,
  eye: Eye,
  hidden: EyeSlash,
  user: UserCircle,
};
export function Icon({ name, size = 20, ...props }) {
  const Component = icons[name] || Car;
  return <Component size={size} weight="regular" aria-hidden="true" {...props} />;
}
export function Select({ children, ...props }) {
  return (
    <span className="select-control">
      <select {...props}>{children}</select>
      <Icon name="down" size={16} />
    </span>
  );
}
export function Modal({ title, children, onClose, wide = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? 'wide' : ''}`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      aria-labelledby="modal-title"
    >
      <div className="modal-top">
        <h2 id="modal-title">{title}</h2>
        <button className="icon-button" aria-label="Close dialog" onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Field({ label, children, hint }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function ErrorBox({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="error-box" role="alert">
      <span>{message}</span>
      {onRetry && (
        <button className="button secondary small" onClick={onRetry}>
          <Icon name="retry" size={16} />
          Try again
        </button>
      )}
    </div>
  );
}
export function Empty({ title, body, action }) {
  return (
    <div className="empty">
      <Icon name="road" size={40} />
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  );
}
export function Skeleton({ cards = 3 }) {
  return (
    <div className="vehicle-grid" aria-label="Loading vehicles" aria-busy="true">
      {Array.from({ length: cards }, (_, i) => (
        <div className="skeleton-card" key={i}>
          <div />
          <span />
          <span />
        </div>
      ))}
    </div>
  );
}
export function useLoad(path, version = 0) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setState((old) => ({ ...old, loading: true, error: null }));
    api(path)
      .then((data) => {
        if (active) setState({ data, loading: false, error: null });
      })
      .catch((error) => {
        if (active) setState({ data: null, loading: false, error: error.message });
      });
    return () => {
      active = false;
    };
  }, [path, version, retry]);
  return { ...state, retry: () => setRetry((x) => x + 1) };
}
export function Rating({ rating, count }) {
  return (
    <span className="rating">
      <Icon name="star" size={15} weight="fill" />
      {count ? (
        <>
          {Number(rating).toFixed(1)} <span>({count})</span>
        </>
      ) : (
        <span>No reviews yet</span>
      )}
    </span>
  );
}
