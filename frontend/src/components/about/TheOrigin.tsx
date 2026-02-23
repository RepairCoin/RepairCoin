import Image from "next/image";
import SectionBadge from "./SectionBadge";

export default function TheOrigin() {
  return (
    <section className="w-full bg-[#0D0D0D] px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-10 lg:gap-16 items-start">
          {/* Left: Text content */}
          <div className="flex-1 pt-2">
            <SectionBadge label="The Origin" />

            <h2 className="mt-6 text-3xl sm:text-4xl lg:text-[2.5rem] font-bold text-white leading-tight">
              Built by a multi-business service entrepreneur with 15+ years of experience
            </h2>

            <p className="mt-6 text-gray-400 text-sm sm:text-base leading-relaxed">
              Managing multiple service businesses, from a boxing gym and salon to a gadget repair
              shop, revealed one clear issue: traditional loyalty systems do not fit real-world
              operations.
            </p>

            <p className="mt-4 text-gray-400 text-sm sm:text-base leading-relaxed">
              Service businesses grow through trust and repeat customers, not endless discounts.
            </p>

            <p className="mt-4 text-gray-400 text-sm sm:text-base leading-relaxed">
              RepairCoin was built from daily experience to reward good service, simplify loyalty,
              and make it easier for customers to return.
            </p>
          </div>

          {/* Right: Image card */}
          <div className="flex-shrink-0 w-full lg:w-[420px]">
            <div className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden">
              <Image
                src="/img/about/the-origin-people-card.png"
                alt="Service entrepreneur helping a customer"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 420px"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
