import { initFlowbite } from "flowbite";

export default function LandingPage() {
  return (
    <main>
      <div className="flex min-h-screen w-full flex-col items-center overflow-hidden">
        {/* header */}
        <nav className="ease-in-ou fixed top-0 left-0 z-20 w-full transition-all duration-300">
          <div className="flex h-full w-full items-center justify-center">
            <div className="flex w-[90%] xl:w-[96%] max-w-screen-2xl flex-col gap-6 xl:flex-row">
              <div className="flex w-full flex-wrap items-center justify-between py-4">
                <a
                  href="/"
                  className="flex items-center space-x-3 rtl:space-x-reverse"
                >
                  <span className="justify-start font-serif leading-10 font-bold">
                    RepairCoin
                  </span>
                </a>
              </div>
            </div>
          </div>
        </nav>
      </div>
    </main>
  );
}
