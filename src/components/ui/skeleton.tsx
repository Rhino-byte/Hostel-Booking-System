import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-muted skeleton-shimmer",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
