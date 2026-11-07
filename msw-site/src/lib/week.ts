/** London-local date helpers shared by forms. */
export function londonToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
}
export function mondayOf(date: string) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
export function dayIdOf(date: string) {
  return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][new Date(`${date}T12:00:00Z`).getUTCDay()];
}
