/** Placeholder shapes shown while server pages stream in. Matches the real card proportions. */
export function CardGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>
          <div className="aspect-[4/5] animate-pulse rounded-[var(--radius-card)] bg-cream" />
          <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-cream" />
          <div className="mt-2 h-4 w-1/3 animate-pulse rounded bg-cream" />
        </div>
      ))}
    </div>
  );
}

export function LoadingLabel() {
  return (
    <p className="sr-only" role="status">
      Yuklanmoqda…
    </p>
  );
}

/** Shown inside the catalog page while products for the current filters load. */
export function CatalogSkeleton() {
  return (
    <div className="container-page pt-8">
      <LoadingLabel />
      <div className="mb-6 h-4 w-48 animate-pulse rounded bg-cream" />
      <div className="mb-8 h-12 w-80 max-w-full animate-pulse rounded-xl bg-cream" />
      <div className="lg:grid lg:grid-cols-[260px_1fr] lg:gap-10">
        <div className="mb-6 h-14 animate-pulse rounded-[var(--radius-card)] bg-cream lg:h-[480px]" />
        <CardGridSkeleton />
      </div>
    </div>
  );
}
