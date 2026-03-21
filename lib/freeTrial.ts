/** Must match SubscriptionGate FREE_TRIAL_DAYS. */
export const APP_FREE_TRIAL_DAYS = 4;

const MS = APP_FREE_TRIAL_DAYS * 24 * 60 * 60 * 1000;

/** ISO timestamp when the in-app free trial ends (auth signup time + trial days). */
export function trialEndIsoFromUserCreatedAt(
  createdAt: string | undefined
): string | null {
  if (!createdAt) return null;
  const start = new Date(createdAt);
  if (Number.isNaN(start.getTime())) return null;
  return new Date(start.getTime() + MS).toISOString();
}

/** Trial window still open; same rules as SubscriptionGate (auth `created_at`). */
export function getActiveAppFreeTrialEndIso(
  authCreatedAt: string | undefined
): string | null {
  const endIso = trialEndIsoFromUserCreatedAt(authCreatedAt);
  if (!endIso) return null;
  if (Date.now() >= new Date(endIso).getTime()) return null;
  return endIso;
}

/**
 * Hides trial UI once the end time has passed (clock-based), without waiting for
 * another `getSubscriptionStatus` run. Prevents stale "0 days left" / "Trial ended" lines.
 */
export function clipExpiredAppFreeTrialEndForUi(
  endIso: string | null
): string | null {
  if (!endIso) return null;
  const end = new Date(endIso).getTime();
  if (Number.isNaN(end)) return null;
  if (Date.now() >= end) return null;
  return endIso;
}

/** User-facing remaining time until app welcome-access period ends (signup-based, not Store intro). */
export function formatAppFreeTrialRemaining(endIso: string): string {
  const end = new Date(endIso).getTime();
  const ms = end - Date.now();
  if (ms <= 0) return 'Trial ended';
  const totalM = Math.ceil(ms / 60000);
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (d >= 1) {
    return `${d} day${d === 1 ? '' : 's'}, ${h} hr${h === 1 ? '' : 's'} left`;
  }
  if (h >= 1) {
    return `${h} hour${h === 1 ? '' : 's'}, ${m} min left`;
  }
  return `${Math.max(1, totalM)} min left`;
}

export function formatAppFreeTrialEndDate(endIso: string): string {
  const d = new Date(endIso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
