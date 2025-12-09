import { cn } from "@/lib/utils";

interface DisableMaskProps {
  disable?: boolean | boolean[];
  content?: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export default function DisableMask({
  disable,
  content,
  children,
  className,
  onClick,
}: DisableMaskProps) {
  const isDisabled = Array.isArray(disable) ? disable.some(Boolean) : disable;

  return (
    <div className={cn("@container relative", className)}>
      <div className={cn(isDisabled && "pointer-events-none grayscale opacity-50")}>
        {children}
      </div>
      {isDisabled && (
        <div
          onClick={onClick}
          className={cn(
            "absolute inset-0 z-10",
            "flex items-center justify-center",
            "bg-white/30 dark:bg-black/30 backdrop-blur-[2px]",
            onClick ? "cursor-pointer" : "cursor-not-allowed"
          )}
        >
          <div
            className={cn(
              "px-4 py-2 rounded-md max-w-[85%]",
              "bg-neutral-900 text-white",
              "text-[clamp(0.75rem,2.5cqi,0.875rem)]",
              "font-semibold text-center",
              "shadow-lg"
            )}
          >
            {content}
          </div>
        </div>
      )}
    </div>
  );
}
