import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const TONES = {
  info: "border-brand-200 bg-brand-50 text-brand-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  error: "border-red-200 bg-red-50 text-red-900",
} as const;

export function Alert({ tone = "info", children, className }: { tone?: keyof typeof TONES; children: ReactNode; className?: string }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("rounded-lg border px-3.5 py-2.5 text-sm", TONES[tone], className)}>
      {children}
    </div>
  );
}
