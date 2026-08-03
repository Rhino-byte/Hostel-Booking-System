import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatKes(amount: number): string {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Fixed locale + timezone so SSR and client match (avoids hydration mismatches). */
export function formatDateTime(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Nairobi",
  }).format(d);
}

export function formatDate(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeZone: "Africa/Nairobi",
  }).format(d);
}

export type FeeStatus = "CLEARED" | "PARTIAL" | "UNPAID" | "OVERPAID";

export function paymentStatus(feeDue: number, totalPaid: number): FeeStatus {
  if (feeDue <= 0) {
    if (totalPaid > 0) return "OVERPAID";
    return "UNPAID";
  }
  if (totalPaid <= 0) return "UNPAID";
  if (totalPaid > feeDue) return "OVERPAID";
  if (totalPaid === feeDue) return "CLEARED";
  return "PARTIAL";
}

