let csrf = null;
export function setCsrf(value) {
  csrf = value;
}
export async function api(path, options = {}) {
  const form = options.body instanceof FormData;
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: 'same-origin',
    headers: {
      ...(options.body && !form ? { 'Content-Type': 'application/json' } : {}),
      ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
      ...options.headers,
    },
    body: options.body ? (form ? options.body : JSON.stringify(options.body)) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && csrf && !['/auth/login', '/profile/password'].includes(path)) {
      csrf = null;
      window.dispatchEvent(new Event('wheels-session-expired'));
    }
    const error = new Error(data.error || 'Unable to load data. Please try again.');
    error.status = response.status;
    throw error;
  }
  return data;
}
export const money = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: value % 100 ? 2 : 0,
  }).format(value / 100);
export function today() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
export function addDays(date, days) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}
export const dateLabel = (value) =>
  new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
export const statusLabel = (value) =>
  ({
    requested: 'Awaiting approval',
    approved: 'Approved',
    handed_over: 'On the road',
    returned: 'Completed',
    cancelled: 'Cancelled',
    rejected: 'Declined',
  })[value] || value;
