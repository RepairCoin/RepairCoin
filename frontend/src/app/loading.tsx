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

      {/* Hero skeleton */}
      <section className="h-screen flex items-center max-w-[1400px] mx-auto px-4 lg:px-16">
        <div className="flex flex-col lg:flex-row lg:items-center gap-8 w-full">
          {/* Left content */}
          <div className="lg:flex-1 space-y-7">
            {/* Badge */}
            <div className="h-9 w-72 rounded-full bg-[#1a1a1a] animate-pulse" />
            {/* Title */}
            <div className="space-y-3">
              <div className="h-12 md:h-16 w-[460px] max-w-full rounded-lg bg-[#1a1a1a] animate-pulse" />
              <div className="h-12 md:h-16 w-[520px] max-w-full rounded-lg bg-[#1a1a1a] animate-pulse" />
            </div>
            {/* Subtitle */}
            <div className="space-y-2 max-w-[460px]">
              <div className="h-4 w-full rounded bg-[#141414] animate-pulse" />
              <div className="h-4 w-4/5 rounded bg-[#141414] animate-pulse" />
              <div className="h-4 w-3/5 rounded bg-[#141414] animate-pulse" />
            </div>
            {/* CTA button */}
            <div className="h-12 w-44 rounded-lg bg-[#1a1a1a] animate-pulse" />
          </div>

          {/* Right content - device mockups */}
          <div className="hidden lg:flex lg:flex-1 items-center justify-center">
            <div className="w-[500px] h-[350px] rounded-xl bg-[#111] animate-pulse" />
          </div>
        </div>
      </section>
    </div>
  );
}
