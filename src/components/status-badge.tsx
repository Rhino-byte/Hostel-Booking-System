import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  CircleDashed,
  AlertCircle,
  TrendingUp,
} from "lucide-react";
import type { FeeStatus } from "@/lib/utils";

const map: Record<
  FeeStatus,
  {
    variant: "paid" | "partial" | "unpaid" | "gold";
    label: string;
    Icon: typeof CheckCircle2;
  }
> = {
  CLEARED: {
    variant: "paid",
    label: "Cleared",
    Icon: CheckCircle2,
  },
  PARTIAL: {
    variant: "partial",
    label: "Paid partially",
    Icon: CircleDashed,
  },
  UNPAID: {
    variant: "unpaid",
    label: "Outstanding",
    Icon: AlertCircle,
  },
  OVERPAID: {
    variant: "gold",
    label: "Overpaid",
    Icon: TrendingUp,
  },
};

export function StatusBadge({ status }: { status: FeeStatus }) {
  const { variant, label, Icon } = map[status];
  return (
    <Badge variant={variant}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}
