/**
 * Request time for server components.  Pages here render per request
 * (no static caching), so reading the clock during render is intended.
 */
export function requestNow(): number {
  return Date.now();
}
