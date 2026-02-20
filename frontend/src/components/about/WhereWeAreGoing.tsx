import SectionBadge from "./SectionBadge";

const phases = [
  {
    phase: "Phase 1",
    title: "Launch the first wave of partner shops",
    description:
      "Ship the core earn and redeem loop with a tight partner onboarding experience.",
  },
  {
    phase: "Phase 2",
    title: "Expand to cross-shop loyalty",
    description:
      "Enable rewards to travel within a curated network of trusted service businesses.",
  },
  {
    phase: "Phase 3",
    title: "Level up retention systems",
    description:
      "Deeper insights, smarter nudges, and automated campaigns that drive repeat visits.",
  },
];

export default function WhereWeAreGoing() {
  return (
    <section className="w-full bg-[#0D0D0D] px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-14">
          <SectionBadge label="Where we are going" />
          <h2 className="mt-6 text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight">
            A loyalty layer for service businesses
          </h2>
          <p className="mt-4 max-w-2xl mx-auto text-gray-400 text-sm sm:text-base leading-relaxed">
            Not to replace human relationships, but to strengthen them with consistent rewards and
            clear feedback loops.
          </p>
        </div>

        {/* Phase cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {phases.map((item) => (
            <div
              key={item.phase}
              className="rounded-[32px] border border-white/5 p-8"
              style={{
                background: "linear-gradient(135deg, rgba(0,0,0,0.16) 0%, rgba(58,58,76,0.16) 100%)",
              }}
            >
              <span className="inline-block px-3 py-1 rounded-md bg-[#2a2000] border border-[#ffcc00]/30 text-[#ffcc00] text-xs font-semibold mb-5">
                {item.phase}
              </span>
              <h3 className="text-xl font-bold text-white mb-3 leading-snug">{item.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
