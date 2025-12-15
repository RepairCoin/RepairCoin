import { cn } from "@/lib/utils";
import { Shield } from "lucide-react";

type StatusVariant = "pending" | "restricted" | "default";

interface ToggleDisableWrapperProps {
  disable?: boolean | boolean[];
  title?: string;
  content?: string[];
  variant?: StatusVariant;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

const variantStyles: Record<StatusVariant, { bg: string; border: string; icon: string }> = {
  pending: {
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    icon: "text-blue-400",
  },
  restricted: {
    bg: "bg-orange-500/10",
    border: "border-orange-500/30",
    icon: "text-orange-400",
  },
  default: {
    bg: "bg-neutral-500/10",
    border: "border-neutral-500/30",
    icon: "text-neutral-400",
  },
};

export default function ToggleDisableWrapper({
  disable,
  title = "Restricted Access",
  content = [],
  variant = "default",
  children,
  className,
  onClick,
}: ToggleDisableWrapperProps) {
  const isDisabled = Array.isArray(disable) ? disable.some(Boolean) : disable;
  const styles = variantStyles[variant];

  if (!isDisabled) {
    return <>{children}</>;
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        "p-5 rounded-lg border",
        styles.bg,
        styles.border,
        onClick ? "cursor-pointer" : "cursor-not-allowed",
        className
      )}
    >
      <div className="flex items-start gap-4">
        <Shield className={cn("w-6 h-6 flex-shrink-0 mt-0.5", styles.icon)} />
        <div>
          <h4 className="text-base font-bold text-white mb-2">{title}</h4>
          {content.length > 0 && (
            <ul className="list-disc list-inside space-y-1.5 text-gray-300 text-sm">
              {content.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
