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
  valueClassName = "text-2xl md:text-3xl font-bold text-white",
  titleClassName = "text-base md:text-lg font-medium text-[#FFCC00]",
  subtitleClassName = "text-sm text-gray-400",
}) => {
  return (
    <div
      className="rounded-2xl shadow-xl p-2 md:p-6 h-full"
      style={{
        backgroundImage: `url('${backgroundImage}')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="flex items-center justify-between h-full">
        <div className="flex flex-col gap-1 flex-1">
          <p className={valueClassName}>{value}</p>
          <p className={titleClassName}>{title}</p>
          {subtitle && <p className={subtitleClassName}>{subtitle}</p>}
        </div>
        {icon && (
          <div className="flex items-center justify-center w-16 h-16 ml-4 flex-shrink-0">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};