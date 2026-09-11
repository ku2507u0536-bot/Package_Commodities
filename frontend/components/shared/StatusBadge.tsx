"use client";

import { cn } from "@/lib/utils";
import type { InspectionResult, VerificationStatus } from "@/lib/types";

interface StatusBadgeProps {
  type: "result" | "verification" | "compliance" | "severity" | "field";
  value: string;
  className?: string;
}

export function StatusBadge({ type, value, className }: StatusBadgeProps) {
  const config = getConfig(type, value);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        config.bg,
        config.text,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dot)} />
      {config.label}
    </span>
  );
}

function getConfig(type: string, value: string) {
  if (type === "result") {
    switch (value as InspectionResult) {
      case "compliant":
        return { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", label: "Compliant" };
      case "potential_violation":
        return { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500", label: "Potential Violation" };
      case "needs_review":
        return { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", label: "Needs Review" };
      default:
        return { bg: "bg-gray-50", text: "text-gray-600", dot: "bg-gray-400", label: value };
    }
  }

  if (type === "verification") {
    switch (value as VerificationStatus) {
      case "verified":
        return { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", label: "Verified" };
      case "confirmed_violation":
        return { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500", label: "Violation Confirmed" };
      case "further_review":
        return { bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-500", label: "Further Review" };
      case "pending":
        return { bg: "bg-slate-50", text: "text-slate-600", dot: "bg-slate-400", label: "Pending" };
      default:
        return { bg: "bg-gray-50", text: "text-gray-600", dot: "bg-gray-400", label: value };
    }
  }

  if (type === "compliance") {
    switch (value) {
      case "pass":
        return { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", label: "Pass" };
      case "fail":
        return { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500", label: "Potential Violation" };
      case "needs_review":
        return { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", label: "Needs Review" };
      default:
        return { bg: "bg-gray-50", text: "text-gray-600", dot: "bg-gray-400", label: value };
    }
  }

  if (type === "severity") {
    switch (value) {
      case "high":
        return { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500", label: "High" };
      case "medium":
        return { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", label: "Medium" };
      case "low":
        return { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500", label: "Low" };
      default:
        return { bg: "bg-gray-50", text: "text-gray-600", dot: "bg-gray-400", label: value };
    }
  }

  if (type === "field") {
    switch (value) {
      case "detected":
        return { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", label: "Detected" };
      case "needs_review":
        return { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", label: "Needs Review" };
      case "missing":
        return { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500", label: "Missing" };
      default:
        return { bg: "bg-gray-50", text: "text-gray-600", dot: "bg-gray-400", label: value };
    }
  }

  return { bg: "bg-gray-50", text: "text-gray-600", dot: "bg-gray-400", label: value };
}
