export default function Loading() {
  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white">
      {/* Hero Skeleton - matches FeaturesHero two-column layout (copy + mascot) */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-28 pb-16 md:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-10 lg:gap-8 items-center">
            {/* Left: copy */}
            <div className="flex flex-col items-center lg:items-start">
              <div className="h-9 w-44 rounded-full bg-[#1a1a1a] animate-pulse mb-8" />
              <div className="flex flex-col gap-4 w-full items-center lg:items-start">
                <div className="h-11 md:h-14 w-[300px] md:w-[460px] max-w-full rounded-lg bg-[#1a1a1a] animate-pulse" />
                <div className="h-11 md:h-14 w-[260px] md:w-[420px] max-w-full rounded-lg bg-[#1a1a1a] animate-pulse" />
                <div className="h-11 md:h-14 w-[200px] md:w-[340px] max-w-full rounded-lg bg-[#1a1a1a] animate-pulse" />
              </div>
              <div className="flex flex-col gap-2 w-full max-w-2xl items-center lg:items-start mt-8">
                <div className="h-5 w-full max-w-[460px] rounded bg-[#141414] animate-pulse" />
                <div className="h-5 w-full max-w-[400px] rounded bg-[#141414] animate-pulse" />
              </div>
              {/* Tab toggle */}
              <div className="h-11 w-64 rounded-lg bg-[#181818] border border-[#2a2a2a] animate-pulse mt-10" />
            </div>

            {/* Right: mascot */}
            <div className="hidden lg:block h-[420px] rounded-2xl bg-[#141414] animate-pulse" />
          </div>
        </div>
      </section>

      {/* Feature Showcase Rows Skeleton (alternating copy / image) */}
      {Array.from({ length: 3 }).map((_, i) => {
        const reverse = i % 2 === 1;
        return (
          <section key={i} className="max-w-7xl mx-auto px-4 sm:px-6 py-6 md:py-8">
            <div
              className={`grid grid-cols-1 gap-10 lg:gap-16 items-center ${
                reverse ? "lg:grid-cols-[2fr_1fr]" : "lg:grid-cols-[1fr_2fr]"
              }`}
            >
              {/* Copy */}
              <div className={reverse ? "lg:order-2" : "lg:order-1"}>
                <div className="h-9 w-40 rounded-lg bg-[#1a1a1a] animate-pulse mb-5" />
                <div className="h-9 md:h-10 w-[360px] max-w-full rounded-lg bg-[#1a1a1a] animate-pulse mb-4" />
                <div className="space-y-2 max-w-xl mb-8">
                  <div className="h-4 w-full rounded bg-[#141414] animate-pulse" />
                  <div className="h-4 w-5/6 rounded bg-[#141414] animate-pulse" />
                </div>
                <div className="space-y-4">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <div key={j} className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-[#1a1a1a] animate-pulse shrink-0" />
                      <div className="h-4 w-48 rounded bg-[#141414] animate-pulse" />
                    </div>
                  ))}
                </div>
              </div>
              {/* Image */}
              <div
                className={`${
                  reverse ? "lg:order-1" : "lg:order-2"
                } w-full aspect-[1100/720] rounded-2xl bg-[#141414] animate-pulse`}
              />
            </div>
          </section>
        );
      })}

      {/* CTA Skeleton */}
      <section className="px-4 lg:px-8 py-12 sm:py-20 lg:py-28">
        <div className="max-w-3xl mx-auto flex flex-col items-center text-center gap-6 sm:gap-8">
          <div className="flex flex-col items-center gap-4">
            <div className="h-9 md:h-12 w-[280px] md:w-[400px] max-w-full rounded-lg bg-[#1a1a1a] animate-pulse" />
            <div className="h-9 md:h-12 w-[240px] md:w-[360px] max-w-full rounded-lg bg-[#1a1a1a] animate-pulse" />
          </div>
          <div className="space-y-2 w-full max-w-xl flex flex-col items-center">
            <div className="h-4 w-full rounded bg-[#141414] animate-pulse" />
            <div className="h-4 w-5/6 rounded bg-[#141414] animate-pulse" />
          </div>
          <div className="h-[3.25rem] w-44 rounded-lg bg-[#1a1a1a] animate-pulse" />
        </div>
      </section>
    </div>
  );
}
