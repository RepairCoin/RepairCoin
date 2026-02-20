import SectionBadge from "./SectionBadge";

export default function AboutHero() {
  return (
    <section className="relative h-screen w-full bg-[#0D0D0D] overflow-hidden">
      {/* Background particle wave pattern */}
      <div
        className="absolute inset-0 bg-no-repeat bg-right-bottom opacity-40"
        style={{
          backgroundImage: "url(/img/about/bg-design.png)",
          backgroundSize: "contain",
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full px-4 text-center">
        <SectionBadge label="About RepairCoin" />

        <h1 className="mt-10 text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-bold text-white leading-tight">
          The story behind
          <br />
          <span className="relative inline-block">
            RepairCoin
            {/* Yellow underline curve */}
            <svg
              className="absolute -bottom-2 left-0 w-full"
              viewBox="0 0 300 12"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              preserveAspectRatio="none"
            >
              <path
                d="M2 8C50 2 100 2 150 5C200 8 250 4 298 2"
                stroke="#ffcc00"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          </span>
        </h1>

        <p className="mt-10 max-w-2xl text-gray-400 text-lg sm:text-xl leading-relaxed">
          RepairCoin is a modern loyalty platform for service businesses, created from everyday
          operations and focused on long term customer relationships.
        </p>
      </div>
    </section>
  );
}
