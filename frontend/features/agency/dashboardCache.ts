/** The backend keeps each agency dashboard snapshot for 30 seconds. */
export const AGENCY_DASHBOARD_SNAPSHOT_MAX_AGE_MS = 30_000;

export function shouldRefetchAgencyDashboard(generatedAt: string | undefined, now = Date.now()): boolean {
  const snapshotTime = Date.parse(generatedAt ?? '');
  const age = now - snapshotTime;
  return !Number.isFinite(age) || age < 0 || age >= AGENCY_DASHBOARD_SNAPSHOT_MAX_AGE_MS;
}
