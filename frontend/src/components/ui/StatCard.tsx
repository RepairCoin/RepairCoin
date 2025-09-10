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
  valueClassName = "text-3xl font-bold text-white",
  titleClassName = "text-lg font-medium text-[#FFCC00]",
  subtitleClassName = "text-sm text-gray-400",
}) => {
  return (
    <div
      className="rounded-2xl shadow-xl p-6"
      style={{
        backgroundImage: `url('${backgroundImage}')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="flex items-center gap-4 justify-between">
        <div className="flex flex-col gap-2">
          <p className={valueClassName}>{value}</p>
          <p className={titleClassName}>{title}</p>
          {subtitle && <p className={subtitleClassName}>{subtitle}</p>}
        </div>
        {icon && <div className="w-20 text-3xl">{icon}</div>}
      </div>
    </div>
  );
};