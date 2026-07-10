export default function Loading() {
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Navbar skeleton */}
      <div className="h-16 border-b border-[#1a1a1a] px-4 lg:px-12 flex items-center justify-between">
        <div className="h-8 w-40 rounded bg-[#1a1a1a] animate-pulse" />
        <div className="hidden md:flex items-center gap-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-4 w-16 rounded bg-[#141414] animate-pulse" />
          ))}
        </div>
        <div className="h-9 w-20 rounded-lg bg-[#1a1a1a] animate-pulse" />
      </div>

      {/* Hero skeleton - matches HeroSection [2fr_1fr] copy + mascot layout */}
      <section className="min-h-[calc(100svh-4rem)] flex flex-col justify-center max-w-7xl mx-auto px-4 lg:px-8 pt-24 pb-12 sm:pt-28 lg:py-28">
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] items-center gap-10 lg:gap-12">
          {/* Left content */}
          <div className="space-y-6 sm:space-y-7">
            {/* Badge */}
            <div className="h-9 w-72 rounded-full bg-[#1a1a1a] animate-pulse" />
            {/* Title */}
            <div className="space-y-3">
              <div className="h-12 md:h-16 w-[460px] max-w-full rounded-lg bg-[#1a1a1a] animate-pulse" />
              <div className="h-12 md:h-16 w-[520px] max-w-full rounded-lg bg-[#1a1a1a] animate-pulse" />
            </div>
            {/* Subtitle */}
            <div className="space-y-2 max-w-[480px]">
              <div className="h-4 w-full rounded bg-[#141414] animate-pulse" />
              <div className="h-4 w-4/5 rounded bg-[#141414] animate-pulse" />
              <div className="h-4 w-3/5 rounded bg-[#141414] animate-pulse" />
            </div>
            {/* CTA button */}
            <div className="h-12 w-44 rounded-xl bg-[#1a1a1a] animate-pulse" />
          </div>

          {/* Right content - mascot */}
          <div className="hidden lg:flex items-center justify-end">
            <div className="w-full aspect-[7/5] rounded-xl bg-[#111] animate-pulse" />
          </div>
        </div>

        {/* AI assistant chat bar */}
        <div className="mt-10 lg:mt-12">
          <div className="h-4 w-72 rounded bg-[#141414] animate-pulse mb-3 ml-6" />
          <div className="h-14 w-full lg:w-1/2 rounded-full bg-[#141414] animate-pulse" />
        </div>
      </section>
    </div>
  );
}
