export default function Loading() {
  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white">
      {/* Hero Skeleton - matches AboutHero two-column layout */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-28 pb-16 md:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-10 lg:gap-8 items-center">
            {/* Left: copy */}
            <div className="flex flex-col items-center lg:items-start">
              <div className="h-9 w-36 rounded-full bg-[#1a1a1a] animate-pulse mb-8" />
              <div className="flex flex-col gap-4 w-full items-center lg:items-start">
                <div className="h-12 md:h-14 w-[320px] md:w-[480px] max-w-full rounded-lg bg-[#1a1a1a] animate-pulse" />
                <div className="h-12 md:h-14 w-[280px] md:w-[440px] max-w-full rounded-lg bg-[#1a1a1a] animate-pulse" />
              </div>
              <div className="flex flex-col gap-2 w-full max-w-2xl items-center lg:items-start mt-8">
                <div className="h-5 w-full max-w-[460px] rounded bg-[#141414] animate-pulse" />
                <div className="h-5 w-full max-w-[420px] rounded bg-[#141414] animate-pulse" />
                <div className="h-5 w-2/3 max-w-[320px] rounded bg-[#141414] animate-pulse" />
              </div>
            </div>

            {/* Right: mascot */}
            <div className="hidden lg:block h-[380px] rounded-2xl bg-[#141414] animate-pulse" />
          </div>
        </div>
      </section>

      {/* Story Section Skeletons (Founder Story / Why FixFlow / Platform Overview) */}
      {Array.from({ length: 3 }).map((_, i) => (
        <section key={i} className="w-full px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-10 lg:gap-16 items-center">
              {/* Copy */}
              <div>
                <div className="h-9 w-44 rounded-lg bg-[#1a1a1a] animate-pulse mb-5" />
                <div className="h-9 md:h-10 w-[420px] max-w-full rounded-lg bg-[#1a1a1a] animate-pulse mb-5" />
                <div className="space-y-3 max-w-xl">
                  <div className="h-4 w-full rounded bg-[#141414] animate-pulse" />
                  <div className="h-4 w-full rounded bg-[#141414] animate-pulse" />
                  <div className="h-4 w-2/3 rounded bg-[#141414] animate-pulse" />
                </div>
              </div>
              {/* Image */}
              <div className="w-full aspect-[5/4] rounded-2xl bg-[#141414] animate-pulse" />
            </div>
          </div>
        </section>
      ))}

      {/* CTA Skeleton */}
      <section className="px-4 lg:px-8 py-12 sm:py-20 lg:py-28">
        <div className="max-w-3xl mx-auto flex flex-col items-center text-center gap-6 sm:gap-8">
          <div className="flex flex-col items-center gap-4">
            <div className="h-9 md:h-12 w-[300px] md:w-[420px] max-w-full rounded-lg bg-[#1a1a1a] animate-pulse" />
            <div className="h-9 md:h-12 w-[220px] md:w-[320px] max-w-full rounded-lg bg-[#1a1a1a] animate-pulse" />
          </div>
          <div className="space-y-2 w-full max-w-xl flex flex-col items-center">
            <div className="h-4 w-full rounded bg-[#141414] animate-pulse" />
            <div className="h-4 w-5/6 rounded bg-[#141414] animate-pulse" />
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="h-[3.25rem] w-44 rounded-lg bg-[#1a1a1a] animate-pulse" />
            <div className="h-[3.25rem] w-44 rounded-lg bg-[#1a1a1a] animate-pulse" />
          </div>
        </div>
      </section>
    </div>
  );
}
