import Section from "@/components/Section";

const ThirdSection: React.FC<any> = () => {
  return (
    <div
      className="w-full py-16 xl:py-40 bg-[#0D0D0D]"
      style={{ backgroundImage: `url(/img/mission-vision-chain.png)` }}
    >
      <Section>
        <div className="w-full flex flex-col md:justify-between md:items-center gap-14 md:gap-24">
          <div className="md:w-2/3 flex flex-col md:items-center md:gap-6 gap-4">
            <p className="text-3xl md:text-5xl md:text-center font-bold text-white tracking-wide">
              Our Mission
            </p>
            <p className="text-[#FFCC00] md:text-center text-sm md:text-lg tracking-wide">
              To transform everyday tech repairs into rewarding
              experiences—empowering local shops and customers through the power
              of blockchain.
            </p>
          </div>
          <div className="md:w-2/3 flex flex-col md:items-center md:gap-6 gap-4">
            <p className="text-3xl md:text-5xl md:text-center font-bold text-white tracking-wide">
              Our Vision
            </p>
            <p className="text-[#FFCC00] md:text-center text-sm md:text-lg tracking-wide">
              To build a trusted rewards ecosystem where local repair shops grow
              stronger, and customers feel valued every time they fix their
              devices. We see a future where loyalty isn’t just appreciated—it’s
              rewarded.
            </p>
          </div>
        </div>
      </Section>
    </div>
  );
};

export default ThirdSection;
