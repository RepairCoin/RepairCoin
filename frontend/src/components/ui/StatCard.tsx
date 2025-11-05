import React from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  backgroundImage?: string;
  valueClassName?: string;
  titleClassName?: string;
  subtitleClassName?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  backgroundImage = "/img/stat-card.png",
  valueClassName = "text-base md:text-lg lg:text-xl font-bold text-white",
  titleClassName = "text-sm md:text-base lg:text-lg font-medium text-[#FFCC00]",
  subtitleClassName = "text-xs sm:text-sm text-gray-400",
}) => {
  return (
    <div
      className="relative rounded-2xl shadow-xl p-3 sm:p-4 md:p-6 h-full"
      style={{
        backgroundImage: `url('${backgroundImage}')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="flex items-center h-full">
        <div className={`flex flex-col gap-0.5 sm:gap-1 flex-1 min-w-0 ${icon ? "pr-12 sm:pr-14 md:pr-16" : ""}`}>
          <p className={valueClassName}>{value}</p>
          <p className={titleClassName}>{title}</p>
          {subtitle && <p className={subtitleClassName}>{subtitle}</p>}
        </div>
        {icon && (
          <div className={`absolute flex items-center justify-center w-10 h-10 ${title === "Your Tier Level" ? "w-20 md:w-32 h-32 top-[-16px] md:top-2 right-[-6px] md:right-[-24px]" : "md:w-14 md:h-14 top-1/2 -translate-y-1/2 right-3 md:right-4"} flex-shrink-0`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};