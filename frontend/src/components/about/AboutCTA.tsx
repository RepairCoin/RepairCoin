export default function AboutCTA() {
  return (
    <section className="relative w-full bg-[#0D0D0D] overflow-hidden">
      {/* Background particle wave pattern */}
      <div
        className="absolute inset-0 bg-no-repeat bg-right-bottom opacity-30"
        style={{
          backgroundImage: "url(/img/about/bg-design.png)",
          backgroundSize: "60%",
        }}
      />

      <div className="relative z-10 px-4 sm:px-6 lg:px-8">
        {/* CTA Section */}
        <div className="max-w-6xl mx-auto text-center pt-20 pb-20 lg:pt-28 lg:pb-28">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight">
            Join RepairCoin as an
            <br />
            <span className="relative inline-block">
              early partner
              {/* Yellow underline curve */}
              <svg
                className="absolute -bottom-8 -left-[3%] w-[106%] h-[18px]"
                viewBox="0 0 311 8"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                preserveAspectRatio="none"
              >
                <path
                  d="M2 5.5C80 1.5 230 1.5 309 5.5"
                  stroke="#ffcc00"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </h2>

          <p className="mt-10 mx-auto text-gray-400 text-base leading-relaxed whitespace-nowrap">
            Be among the first to launch, test, and grow with RepairCoin from day one.
          </p>

        </div>
      </div>
    </section>
  );
}
