export default function Loading() {
  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white">
      {/* Hero Skeleton - matches AboutHero h-screen centered layout */}
      <section className="relative h-screen flex flex-col items-center justify-center px-4 text-center">
        {/* Badge */}
        <div className="h-10 w-48 rounded-full bg-[#1a1a1a] animate-pulse" />

        {/* Title - two lines */}
        <div className="flex flex-col items-center gap-4 mt-10">
          <div className="h-10 sm:h-12 md:h-14 lg:h-[4.25rem] w-[300px] sm:w-[400px] md:w-[540px] lg:w-[620px] max-w-full rounded-lg bg-[#1a1a1a] animate-pulse" />
          <div className="h-10 sm:h-12 md:h-14 lg:h-[4.25rem] w-[240px] sm:w-[340px] md:w-[440px] lg:w-[520px] max-w-full rounded-lg bg-[#1a1a1a] animate-pulse" />
        </div>

        {/* Subtitle */}
        <div className="flex flex-col items-center gap-2 mt-10 max-w-2xl">
          <div className="h-5 w-[420px] max-w-full rounded bg-[#141414] animate-pulse" />
          <div className="h-5 w-[460px] max-w-full rounded bg-[#141414] animate-pulse" />
          <div className="h-5 w-[320px] max-w-full rounded bg-[#141414] animate-pulse" />
        </div>

        {/* CTA button */}
        <div className="h-12 w-44 rounded-lg bg-[#1a1a1a] animate-pulse mt-8" />
      </section>

      {/* TheOrigin Section Skeleton */}
      <section className="max-w-4xl mx-auto px-4 py-16 md:py-24">
        <div className="flex flex-col items-center text-center">
          <div className="h-10 w-40 rounded-full bg-[#1a1a1a] animate-pulse mb-8" />
          <div className="h-8 md:h-10 w-[500px] max-w-full rounded-lg bg-[#1a1a1a] animate-pulse mb-6" />
          <div className="space-y-3 w-full max-w-2xl">
            <div className="h-4 w-full rounded bg-[#141414] animate-pulse" />
            <div className="h-4 w-full rounded bg-[#141414] animate-pulse" />
            <div className="h-4 w-3/4 mx-auto rounded bg-[#141414] animate-pulse" />
          </div>
        </div>
      </section>

      {/* OurApproach Section Skeleton */}
      <section className="max-w-5xl mx-auto px-4 pb-16">
        <div className="flex flex-col items-center mb-10">
          <div className="h-10 w-36 rounded-full bg-[#1a1a1a] animate-pulse mb-6" />
          <div className="h-8 md:h-10 w-[480px] max-w-full rounded-lg bg-[#1a1a1a] animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="border border-[#2a2a2a] rounded-2xl p-6"
              style={{ background: "linear-gradient(145deg, #0e0e12 0%, #0d0d11 55%, #080809 100%)" }}
            >
              <div className="w-10 h-10 rounded-lg bg-[#252525] animate-pulse mb-4" />
              <div className="h-5 w-40 rounded bg-[#1a1a1a] animate-pulse mb-3" />
              <div className="space-y-2">
                <div className="h-3.5 w-full rounded bg-[#141414] animate-pulse" />
                <div className="h-3.5 w-5/6 rounded bg-[#141414] animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
