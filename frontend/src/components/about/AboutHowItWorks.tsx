import Image from "next/image";
import SectionBadge from "./SectionBadge";

const steps = [
  {
    image: "/img/about/howitworks-card1.png",
    title: "A service is completed like any other transaction.",
    description: "RepairCoin works quietly in the background.",
  },
  {
    image: "/img/about/howitworks-card2.png",
    title: "Rewards are automatically added after the service.",
    description:
      "Both businesses and customers can trust that every reward is accurately tracked.",
  },
  {
    image: "/img/about/howitworks-card3.png",
    title: "Customers use their rewards across the RepairCoin network.",
    description: "More reasons to return and explore other shops.",
  },
];

export default function AboutHowItWorks() {
  return (
    <section className="w-full bg-[#0D0D0D] px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-14">
          <SectionBadge label="How it works" />
          <h2 className="mt-6 text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight">
            How RepairCoin fits into your workflow
          </h2>
          <p className="mt-4 max-w-2xl mx-auto text-gray-400 text-sm sm:text-base leading-relaxed">
            A simple flow that fits naturally into daily operations, from checkout to repeat visits.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {steps.map((step) => (
            <div
              key={step.title}
              className="rounded-[32px] border border-white/5 overflow-hidden"
              style={{
                background: "linear-gradient(135deg, rgba(0,0,0,0.16) 0%, rgba(58,58,76,0.16) 100%)",
              }}
            >
              {/* Image */}
              <div className="relative w-full aspect-[4/3]">
                <Image
                  src={step.image}
                  alt={step.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
              </div>

              {/* Text */}
              <div className="p-6 text-center">
                <h3 className="text-base font-bold text-white mb-3 leading-snug">
                  {step.title}
                </h3>
                <div className="w-full h-px bg-white/10 mb-3" />
                <p className="text-gray-400 text-sm leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
