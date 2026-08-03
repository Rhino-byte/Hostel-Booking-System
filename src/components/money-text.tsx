import { cn, formatKes } from "@/lib/utils";

export function MoneyText({
  amount,
  className,
}: {
  amount: number;
  className?: string;
}) {
  return (
    <span className={cn("font-sans tabular-nums tracking-tight", className)}>
      {formatKes(amount)}
    </span>
  );
}
