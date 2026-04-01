import { ReactNode } from "react";

interface SectionBadgeProps {
  label: string;
  icon?: ReactNode;
  className?: string;
}

export default function SectionBadge({ label, icon, className = "" }: SectionBadgeProps) {
  return (
    <div
      className={`inline-flex items-center gap-3 px-8 py-3 text-[#ffe680] ${className}`}
      style={{
        background: "#0D0D0D",
        border: "1px solid #FFCC00",
        borderRadius: "9999px",
        boxShadow: "0px -7px 16px 2px rgba(164, 143, 255, 0.2) inset",
      }}
    >
      {icon ?? (
        <img
          src="/img/waitlist/hero/shining.svg"
          alt=""
          className="w-5 h-5 md:w-6 md:h-6"
        />
      )}
      <span className="text-sm md:text-base font-semibold" style={{ color: "#ffe680" }}>{label}</span>
    </div>
  );
}
