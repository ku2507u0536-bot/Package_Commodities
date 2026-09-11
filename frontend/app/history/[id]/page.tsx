"use client";

import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download, CheckCircle2, AlertTriangle, Clock, FileText } from "lucide-react";
import { mockInspections } from "@/lib/mock-data/inspections";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDate, formatDateTime, cn } from "@/lib/utils";

export default function InspectionDetailPage({ params }: { params: { id: string } }) {
  const inspection = mockInspections.find((i) => i.id === params.id);
  if (!inspection) notFound();

  const { product, extractedFields, complianceChecks, violations, verification } = inspection;
  const passed = complianceChecks.filter((c) => c.status === "pass").length;
  const failed = complianceChecks.filter((c) => c.status === "fail").length;
  const review = complianceChecks.filter((c) => c.status === "needs_review").length;

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Back + actions */}
      <div className="flex items-center justify-between">
        <Link
          href="/history"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to History
        </Link>
        <div className="flex items-center gap-2">
          {inspection.reportId && (
            <Link
              href={`/reports/${inspection.reportId}`}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              <FileText className="h-3.5 w-3.5" /> View Report
            </Link>
          )}
          <button className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors">
            <Download className="h-3.5 w-3.5" /> Download
          </button>
        </div>
      </div>

      {/* Header card */}
      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs text-muted-foreground">{inspection.id}</span>
              <StatusBadge type="result" value={inspection.result} />
              <StatusBadge type="verification" value={inspection.verificationStatus} />
            </div>
            <h2 className="text-lg font-bold text-foreground">{product.name}</h2>
            <p className="text-sm text-muted-foreground">{product.brand} · {product.category}</p>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <p>Inspected: {formatDateTime(inspection.createdAt)}</p>
            <p className="mt-0.5">Inspector: {inspection.inspectorName}</p>
            <p className="font-mono mt-0.5">{inspection.inspectorId}</p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-5">
          {/* Extracted Information */}
          <div className="bg-card rounded-xl border border-border">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Extracted Information</h3>
            </div>
            <div className="divide-y divide-border">
              {extractedFields.map((field) => (
                <div
                  key={field.label}
                  className={cn(
                    "flex items-start justify-between px-4 py-3 gap-4",
                    field.status === "missing" && "bg-red-50/30",
                    field.status === "needs_review" && "bg-amber-50/30"
                  )}
                >
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground">{field.label}</p>
                    <p className={cn("text-sm font-medium mt-0.5", field.value ? "text-foreground" : "text-red-500 italic")}>
                      {field.value ?? "Not detected"}
                    </p>
                    {field.confidence !== undefined && field.confidence > 0 && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">Confidence: {field.confidence}%</p>
                    )}
                  </div>
                  <StatusBadge type="field" value={field.status} />
                </div>
              ))}
            </div>
          </div>

          {/* Compliance Checks */}
          <div className="bg-card rounded-xl border border-border">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Compliance Checks</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase">Requirement</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase">Value</th>
                    <th className="hidden sm:table-cell px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase">Rule</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {complianceChecks.map((c) => (
                    <tr
                      key={c.id}
                      className={cn(
                        "hover:bg-muted/20",
                        c.status === "fail" && "bg-red-50/40",
                        c.status === "needs_review" && "bg-amber-50/40"
                      )}
                    >
                      <td className="px-4 py-2.5 text-xs font-medium text-foreground">{c.requirement}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{c.value ?? "—"}</td>
                      <td className="hidden sm:table-cell px-4 py-2.5 text-[10px] font-mono text-muted-foreground">{c.rule}</td>
                      <td className="px-4 py-2.5">
                        <StatusBadge type="compliance" value={c.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Violations */}
          {violations.length > 0 && (
            <div className="bg-card rounded-xl border border-red-200">
              <div className="px-5 py-4 border-b border-red-200 bg-red-50/50 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <h3 className="text-sm font-semibold text-red-800">Potential Violations</h3>
              </div>
              <div className="divide-y divide-border">
                {violations.map((v) => (
                  <div key={v.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-foreground">{v.type}</span>
                          <StatusBadge type="severity" value={v.severity} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{v.requirement}</p>
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-[11px] font-medium text-muted-foreground">Issue</p>
                        <p className="text-foreground">{v.issue}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-medium text-muted-foreground">Evidence</p>
                        <p className="text-foreground">{v.evidence}</p>
                      </div>
                    </div>
                    <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                      {v.explanation}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Compliance summary */}
          <div className="bg-card rounded-xl border border-border p-4 space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Compliance Summary</h3>
            {[
              { label: "Passed", value: passed, color: "text-emerald-600", bg: "bg-emerald-50" },
              { label: "Potential Violations", value: failed, color: "text-red-600", bg: "bg-red-50" },
              { label: "Needs Review", value: review, color: "text-amber-600", bg: "bg-amber-50" },
              { label: "Total Checks", value: complianceChecks.length, color: "text-foreground", bg: "bg-muted" },
            ].map((s) => (
              <div key={s.label} className={cn("flex items-center justify-between rounded-lg px-3 py-2", s.bg)}>
                <span className="text-xs text-muted-foreground">{s.label}</span>
                <span className={cn("text-sm font-bold", s.color)}>{s.value}</span>
              </div>
            ))}
          </div>

          {/* Inspector Verification */}
          {verification && (
            <div className="bg-card rounded-xl border border-border p-4 space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Inspector Verification</h3>
              <div className="space-y-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Decision</p>
                  <StatusBadge
                    type="verification"
                    value={
                      verification.decision === "compliant"
                        ? "verified"
                        : verification.decision === "confirmed_violation"
                        ? "confirmed_violation"
                        : "further_review"
                    }
                    className="mt-1"
                  />
                </div>
                {verification.remarks && (
                  <div>
                    <p className="text-muted-foreground">Remarks</p>
                    <p className="text-foreground mt-0.5 leading-snug">{verification.remarks}</p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground">Verified by</p>
                  <p className="text-foreground font-medium">{verification.inspectorName}</p>
                  <p className="text-muted-foreground">{formatDate(verification.verifiedAt)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Product details */}
          <div className="bg-card rounded-xl border border-border p-4 space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Product Details</h3>
            {[
              { label: "Manufacturer", value: product.manufacturer },
              { label: "Address", value: product.address },
              { label: "Country", value: product.countryOfOrigin },
              { label: "Net Quantity", value: product.netQuantity },
              { label: "MRP", value: product.mrp },
            ].map((r) => (
              <div key={r.label}>
                <p className="text-[10px] text-muted-foreground">{r.label}</p>
                <p className="text-xs font-medium text-foreground">{r.value ?? "—"}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
