import Section from "@/components/Section";
import OurStory from "./OurStory";
import WhatWeDo from "./WhatWeDo";

const SecondSection: React.FC<any> = () => {
  return (
    <div
      className="w-full md:pt-10 xl:pt-0 bg-[#0D0D0D]"
      style={{ backgroundImage: `url(/tech-bg.png)` }}
    >
      <Section>
        <div className="w-full flex flex-col items-center gap-14">
          <OurStory />
          <WhatWeDo />
        </div>
      </Section>
    </div>
  );
};

export default SecondSection;
