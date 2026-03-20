export default function Loading() {
  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white">
      {/* Hero Skeleton */}
      <section className="relative min-h-[84vh] flex flex-col items-center justify-center px-4 py-24 md:py-36">
        {/* Badge */}
        <div className="h-9 w-52 rounded-full bg-[#1a1a1a] animate-pulse mb-6 md:mb-8" />

        {/* Title lines */}
        <div className="flex flex-col items-center gap-3 mb-6">
          <div className="h-12 md:h-16 w-[520px] max-w-full rounded-lg bg-[#1a1a1a] animate-pulse" />
          <div className="h-12 md:h-16 w-[580px] max-w-full rounded-lg bg-[#1a1a1a] animate-pulse" />
        </div>

        {/* Subtitle */}
        <div className="flex flex-col items-center gap-2 mb-10 md:mb-20">
          <div className="h-4 w-64 max-w-full rounded bg-[#141414] animate-pulse" />
          <div className="h-4 w-96 max-w-full rounded bg-[#141414] animate-pulse" />
        </div>

        {/* Tab toggle */}
        <div className="h-11 w-64 rounded-full bg-[#181818] animate-pulse" />
      </section>

      {/* Tier Cards Skeleton */}
      <section className="max-w-7xl mx-auto px-4 pt-4 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-7">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="border border-[#2a2a2a] rounded-3xl p-5 md:p-8"
              style={{
                background:
                  "linear-gradient(145deg, #0e0e12 0%, #0d0d11 55%, #080809 100%)",
              }}
            >
              {/* Icon */}
              <div className="w-14 h-14 rounded-full bg-[#252525] animate-pulse mb-6" />
              {/* Title */}
              <div className="h-6 w-36 rounded bg-[#1a1a1a] animate-pulse mb-3" />
              {/* Description */}
              <div className="space-y-2 mb-6">
                <div className="h-3 w-full rounded bg-[#141414] animate-pulse" />
                <div className="h-3 w-5/6 rounded bg-[#141414] animate-pulse" />
              </div>
              {/* Stake pill */}
              <div className="h-9 w-40 rounded-lg bg-[#1a1a1a] animate-pulse mb-6" />
              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="h-16 rounded-xl bg-[#141414] animate-pulse" />
                <div className="h-16 rounded-xl bg-[#141414] animate-pulse" />
              </div>
              {/* Divider */}
              <div className="border-t border-[#1e1e28] mb-6" />
              {/* Benefits */}
              <div className="h-5 w-28 rounded bg-[#1a1a1a] animate-pulse mb-4" />
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
