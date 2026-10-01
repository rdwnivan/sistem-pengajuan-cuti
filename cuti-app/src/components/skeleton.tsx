/** Skeleton statis dengan pulse halus untuk streaming Suspense. */
export function SkeletonBar({ w = "w-full", h = "h-3" }: { w?: string; h?: string }) {
  return <div aria-hidden className={`animate-pulse rounded bg-zinc-200 ${w} ${h}`} />;
}

export function SkeletonCard({ baris = 3 }: { baris?: number }) {
  return (
    <div aria-hidden className="rounded-xl border bg-white p-4">
      <SkeletonBar w="w-28" h="h-4" />
      <div className="mt-3 space-y-2">
        {Array.from({ length: baris }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-zinc-200/70" />
        ))}
      </div>
    </div>
  );
}

export function SkeletonGrid({ kotak = 4 }: { kotak?: number }) {
  return (
    <div aria-hidden className="rounded-xl border bg-white p-4">
      <SkeletonBar w="w-28" h="h-4" />
      <div className="mt-3 grid grid-cols-2 gap-2">
        {Array.from({ length: kotak }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-zinc-200/70" />
        ))}
      </div>
    </div>
  );
}
