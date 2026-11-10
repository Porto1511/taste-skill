/** Date-range presets and parsing for the QS check (London dates, Monday weeks). */
const iso = (d: Date) => d.toISOString().slice(0, 10);
const at = (s: string) => new Date(`${s}T12:00:00Z`);
export const addDaysIso = (s: string, n: number) => { const d = at(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
export const mondayIso = (s: string) => addDaysIso(s, -((at(s).getUTCDay() + 6) % 7));

export function qsPresets(today: string) {
  const mon = mondayIso(today);
  const d = at(today);
  const firstThis = iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 12)));
  const lastThis = iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 12)));
  const firstPrev = iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1, 12)));
  const lastPrev = iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 0, 12)));
  return [
    { label: "This week", from: mon, to: addDaysIso(mon, 6) },
    { label: "Last week", from: addDaysIso(mon, -7), to: addDaysIso(mon, -1) },
    { label: "This month", from: firstThis, to: lastThis },
    { label: "Last month", from: firstPrev, to: lastPrev },
  ];
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f-]{36}$/i;
export function parseQsParams(p: Record<string, string | undefined>, today: string) {
  const def = qsPresets(today)[0];
  let from = p.from && DATE.test(p.from) ? p.from : def.from;
  let to = p.to && DATE.test(p.to) ? p.to : def.to;
  if (from > to) [from, to] = [to, from];
  // Keep ranges sensible (max ~1 year).
  if (at(to).getTime() - at(from).getTime() > 370 * 864e5) from = addDaysIso(to, -370);
  return { from, to, jobId: p.job && UUID.test(p.job) ? p.job : undefined, companyId: p.company && UUID.test(p.company) ? p.company : undefined };
}

export const hrs = (n: number) => `${Math.round(n * 100) / 100}h`;
