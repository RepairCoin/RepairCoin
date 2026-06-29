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

      {/* Hero - centered badge, title, subtitle (matches PricingHero) */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 pt-32 pb-12">
        <div className="flex flex-col items-center text-center">
          <div className="h-9 w-44 rounded-full bg-[#1a1a1a] animate-pulse" />
          <div className="flex flex-col items-center gap-4 mt-6">
            <div className="h-10 sm:h-12 lg:h-14 w-[340px] sm:w-[520px] max-w-full rounded-lg bg-[#1a1a1a] animate-pulse" />
            <div className="h-10 sm:h-12 lg:h-14 w-[300px] sm:w-[480px] max-w-full rounded-lg bg-[#1a1a1a] animate-pulse" />
          </div>
          <div className="flex flex-col items-center gap-2 mt-5 max-w-2xl w-full">
            <div className="h-5 w-full max-w-[520px] rounded bg-[#141414] animate-pulse" />
            <div className="h-5 w-2/3 max-w-[360px] rounded bg-[#141414] animate-pulse" />
          </div>
        </div>

        {/* Pricing cards - 3 white plan cards */}
        <div className="mt-20 grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className={`rounded-lg bg-white p-6 shadow-xl ${
                i === 1 ? "lg:-mt-8 ring-2 ring-[#F7CC00]" : ""
              }`}
            >
              {/* Header */}
              <div className="h-7 w-32 rounded bg-gray-200 animate-pulse" />
              <div className="h-4 w-40 rounded bg-gray-100 animate-pulse mt-3" />
              <div className="h-10 w-28 rounded bg-gray-200 animate-pulse mt-5" />
              <div className="h-3 w-24 rounded bg-gray-100 animate-pulse mt-2" />
              {/* CTA */}
              <div className="h-12 w-full rounded-lg bg-gray-200 animate-pulse mt-5" />
              <div className="h-3 w-44 mx-auto rounded bg-gray-100 animate-pulse mt-3 mb-5 pb-5 border-b border-gray-200" />
              {/* Includes list */}
              <div className="h-4 w-28 rounded bg-gray-200 animate-pulse mt-5" />
              <div className="space-y-3 mt-4">
                {Array.from({ length: 6 }).map((_, j) => (
                  <div key={j} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-gray-200 animate-pulse shrink-0" />
                    <div className="h-3.5 w-full rounded bg-gray-100 animate-pulse" />
                  </div>
                ))}
              </div>
              {/* AI usage */}
              <div className="mt-6 pt-5 border-t border-gray-200 flex items-start gap-4">
                <div className="w-12 h-12 rounded bg-gray-200 animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 rounded bg-gray-200 animate-pulse" />
                  <div className="h-3.5 w-24 rounded bg-gray-100 animate-pulse" />
                  <div className="h-3.5 w-full rounded bg-gray-100 animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
