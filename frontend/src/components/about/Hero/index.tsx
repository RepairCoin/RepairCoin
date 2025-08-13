import Section from "@/components/Section";

const Hero: React.FC<any> = () => {
  return (
    <div className="relative h-[50vh] md:h-[70vh] xl:h-screen w-full bg-[#0D0D0D]">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(/img/about-bg.png)`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      />
      <div className="absolute top-0 left-0 right-0 z-10 h-full">
        <Section>
          <div className="flex w-full flex-col items-center">
            <div className="w-full flex flex-col items-center">
              <p className="text-2xl md:text-4xl xl:text-5xl font-bold text-[#FFCC00] mb-6">
                Repair Smarter. Earn Every Time.
              </p>
              <p className="text-white text-center text-sm md:text-sm xl:text-lg mb-6">
                RepairCoin is redefining how people engage with local tech
                repair — by turning every repair into a reward.
              </p>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
};

export default Hero;
