import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

/**
 * Pulsing placeholder block in the app's dark theme. Use for page-level
 * loading states so content appears to materialize instead of showing a
 * lone spinner.
 */
function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-2xl bg-[#262626]", className)} />
}

/**
 * Generic list/feed loading skeleton — a header bar plus N card rows.
 * Fits list-style tabs (orders, appointments, etc.).
 */
function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-4 animate-fade-in">
      <SkeletonBlock className="h-10 w-48" />
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonBlock key={i} className="h-24 w-full" />
      ))}
    </div>
  )
}

/**
 * Generic form loading skeleton — header plus stacked field rows.
 * Fits form-style tabs (settings, profile).
 */
function FormSkeleton({ fields = 5 }: { fields?: number }) {
  return (
    <div className="space-y-5 animate-fade-in max-w-2xl">
      <SkeletonBlock className="h-10 w-56" />
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <SkeletonBlock className="h-4 w-32 rounded-md" />
          <SkeletonBlock className="h-11 w-full rounded-lg" />
        </div>
      ))}
    </div>
  )
}

export { Skeleton, SkeletonBlock, ListSkeleton, FormSkeleton }
