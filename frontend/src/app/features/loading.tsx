export default function Loading() {
  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white">
      {/* Hero Skeleton - matches FeaturesHero min-h-[75vh] centered layout */}
      <section className="relative min-h-[75vh] flex flex-col items-center justify-center max-w-7xl mx-auto px-4 pt-24 md:pt-0">
        {/* Badge */}
        <div className="h-10 w-80 rounded-full bg-[#1a1a1a] animate-pulse mb-6 md:mb-10" />

        {/* Title - two lines centered */}
        <div className="flex flex-col items-center gap-4 mb-4 md:mb-6">
          <div className="h-8 sm:h-10 md:h-14 lg:h-[4.25rem] w-[320px] sm:w-[440px] md:w-[640px] lg:w-[760px] max-w-full rounded-lg bg-[#1a1a1a] animate-pulse" />
          <div className="h-8 sm:h-10 md:h-14 lg:h-[4.25rem] w-[300px] sm:w-[500px] md:w-[720px] lg:w-[860px] max-w-full rounded-lg bg-[#1a1a1a] animate-pulse" />
        </div>

        {/* Subtitle - two lines */}
        <div className="flex flex-col items-center gap-2 mb-8 md:mb-10">
          <div className="h-4 md:h-5 w-64 md:w-96 max-w-full rounded bg-[#141414] animate-pulse" />
          <div className="h-4 md:h-5 w-80 md:w-[28rem] max-w-full rounded bg-[#141414] animate-pulse" />
        </div>

        {/* Tab toggle */}
        <div className="h-10 md:h-11 w-56 md:w-64 rounded-full bg-[#181818] border border-[#2a2a2a] animate-pulse mb-10 md:mb-16" />
      </section>

      {/* Feature Cards Grid Skeleton - 9 cards in 3-col grid */}
      <section className="max-w-7xl mx-auto px-4 pb-12 md:pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="bg-gradient-to-b from-[#1a1a1a] to-[#0f0f0f] border border-[rgba(83,83,83,0.15)] rounded-2xl p-6"
            >
              {/* Icon circle */}
              <div className="mb-5">
                <div className="w-12 h-12 rounded-full bg-[#252525] animate-pulse" />
              </div>
              {/* Title */}
              <div className="h-5 w-44 rounded bg-[#1a1a1a] animate-pulse mb-2" />
              {/* Description */}
              <div className="space-y-2 mb-5">
                <div className="h-3.5 w-full rounded bg-[#141414] animate-pulse" />
                <div className="h-3.5 w-3/4 rounded bg-[#141414] animate-pulse" />
              </div>
              {/* Detail items with checkmark circles */}
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-[#1a1a1a] animate-pulse shrink-0 mt-0.5" />
                    <div className="h-3.5 w-full rounded bg-[#141414] animate-pulse" />
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
