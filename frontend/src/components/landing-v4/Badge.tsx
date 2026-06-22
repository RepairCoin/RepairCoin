interface BadgeProps {
  label: string;
  className?: string;
}

export default function Badge({ label, className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs sm:text-sm font-semibold ${className}`}
      style={{
        background: "#0D0D0D",
        border: "1px solid #FFCC00",
        boxShadow: "0px -7px 16px 2px rgba(164, 143, 255, 0.2) inset",
        color: "#ffe680",
      }}
    >
      <img src="/img/waitlist/hero/shining.svg" alt="" className="w-4 h-4" />
      {label}
    </span>
  );
}
