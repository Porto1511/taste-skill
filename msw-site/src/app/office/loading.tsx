export default function Loading() {
  return (
    <div className="grid gap-5" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-9 w-72" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton h-24" />)}</div>
      <div className="skeleton h-80 w-full rounded-[var(--radius-card)]" />
    </div>
  );
}
