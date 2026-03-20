export default function Loading() {
  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white">
      {/* Hero Skeleton */}
      <section className="relative min-h-[75vh] flex flex-col items-center justify-center px-4 pt-24 md:pt-0">
        {/* Badge */}
        <div className="h-9 w-72 rounded-full bg-[#1a1a1a] animate-pulse mb-6 md:mb-10" />

        {/* Title lines */}
        <div className="flex flex-col items-center gap-3 mb-6">
          <div className="h-10 md:h-16 w-[500px] max-w-full rounded-lg bg-[#1a1a1a] animate-pulse" />
          <div className="h-10 md:h-16 w-[600px] max-w-full rounded-lg bg-[#1a1a1a] animate-pulse" />
        </div>

        {/* Subtitle */}
        <div className="flex flex-col items-center gap-2 mb-10">
          <div className="h-4 w-80 max-w-full rounded bg-[#141414] animate-pulse" />
          <div className="h-4 w-96 max-w-full rounded bg-[#141414] animate-pulse" />
        </div>

        {/* Tab toggle */}
        <div className="h-11 w-64 rounded-full bg-[#181818] animate-pulse" />
      </section>

      {/* Feature Cards Grid Skeleton */}
      <section className="max-w-7xl mx-auto px-4 pb-12 md:pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-gradient-to-b from-[#1a1a1a] to-[#0f0f0f] border border-[rgba(83,83,83,0.15)] rounded-2xl p-6"
            >
              {/* Icon */}
              <div className="w-12 h-12 rounded-full bg-[#252525] animate-pulse mb-5" />
              {/* Title */}
              <div className="h-5 w-40 rounded bg-[#1a1a1a] animate-pulse mb-3" />
              {/* Description */}
              <div className="space-y-2 mb-5">
                <div className="h-3 w-full rounded bg-[#141414] animate-pulse" />
                <div className="h-3 w-3/4 rounded bg-[#141414] animate-pulse" />
              </div>
              {/* Detail lines */}
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-[#1a1a1a] animate-pulse shrink-0" />
                    <div className="h-3 w-full rounded bg-[#141414] animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
