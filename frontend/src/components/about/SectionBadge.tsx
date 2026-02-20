import { SparklesIcon } from "lucide-react";

interface SectionBadgeProps {
  label: string;
}

export default function SectionBadge({ label }: SectionBadgeProps) {
  return (
    <div className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full border border-[#ffcc00] bg-gradient-to-r from-[#ffcc00]/10 to-transparent text-[#ffcc00]">
      {/* sparkle */}
      <SparklesIcon size={16} className="text-[#ffcc00]" />
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}
