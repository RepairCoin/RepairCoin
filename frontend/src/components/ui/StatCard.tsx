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
      className="rounded-2xl shadow-xl p-3 sm:p-4 md:p-6 h-full"
      style={{
        backgroundImage: `url('${backgroundImage}')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="flex items-center justify-between h-full">
        <div className="flex flex-col gap-0.5 sm:gap-1 flex-1 min-w-0">
          <p className={valueClassName}>{value}</p>
          <p className={titleClassName}>{title}</p>
          {subtitle && <p className={subtitleClassName}>{subtitle}</p>}
        </div>
        {icon && (
          <div className="flex items-center justify-center w-10 h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 ml-2 md:ml-4 flex-shrink-0">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};