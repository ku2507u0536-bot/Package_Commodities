"use client";

import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download, Scale } from "lucide-react";
import { mockReports } from "@/lib/mock-data/reports";
import { mockInspections } from "@/lib/mock-data/inspections";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDate, formatDateTime, cn } from "@/lib/utils";

function ScaleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
      <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
      <path d="M7 21h10" />
      <path d="M12 3v18" />
      <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
    </svg>
  );
}

export default function ReportDetailPage({ params }: { params: { id: string } }) {
  const report = mockReports.find((r) => r.id === params.id);
  if (!report) notFound();

  const inspection = mockInspections.find((i) => i.id === report.inspectionId);
  if (!inspection) notFound();

  const { product, extractedFields, complianceChecks, violations, verification } = inspection;
  const passed = complianceChecks.filter((c) => c.status === "pass").length;
  const failed = complianceChecks.filter((c) => c.status === "fail").length;
  const review = complianceChecks.filter((c) => c.status === "needs_review").length;
  const getValue = (label: string) => extractedFields.find((f) => f.label === label)?.value ?? "—";

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <Link
          href="/reports"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Reports
        </Link>
        <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90 transition-colors">
          <Download className="h-4 w-4" /> Download PDF
        </button>
      </div>

      {/* Report document */}
      <div className="bg-card rounded-xl border border-border overflow-hidden print:border-0">
        {/* Header */}
        <div className="bg-primary px-6 py-6 text-white">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20">
              <ScaleIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Statera Inspection Report</h1>
              <p className="text-primary-foreground/70 text-xs">Legal Metrology (Packaged Commodities) Rules 2011</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs border-t border-white/20 pt-4">
            <div>
              <p className="text-primary-foreground/70">Report ID</p>
              <p className="font-semibold">{report.id}</p>
            </div>
            <div>
              <p className="text-primary-foreground/70">Inspection ID</p>
              <p className="font-semibold">{report.inspectionId}</p>
            </div>
            <div>
              <p className="text-primary-foreground/70">Date Generated</p>
              <p className="font-semibold">{formatDate(report.generatedAt)}</p>
            </div>
            <div>
              <p className="text-primary-foreground/70">Inspector</p>
              <p className="font-semibold">{report.inspectorName}</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Overall result */}
          <div className={cn(
            "rounded-xl p-4 flex items-center gap-4",
            report.result === "compliant" ? "bg-emerald-50 border border-emerald-200" :
            report.result === "potential_violation" ? "bg-red-50 border border-red-200" :
            "bg-amber-50 border border-amber-200"
          )}>
            <div className={cn(
              "flex h-12 w-12 items-center justify-center rounded-full flex-shrink-0",
              report.result === "compliant" ? "bg-emerald-100" :
              report.result === "potential_violation" ? "bg-red-100" :
              "bg-amber-100"
            )}>
              {report.result === "compliant" ? (
                <span className="text-2xl">✓</span>
              ) : (
                <span className="text-2xl">⚠</span>
              )}
            </div>
            <div>
              <p className={cn("text-lg font-bold",
                report.result === "compliant" ? "text-emerald-700" :
                report.result === "potential_violation" ? "text-red-700" : "text-amber-700"
              )}>
                {report.result === "compliant" ? "Compliant" : report.result === "potential_violation" ? "Potential Violation" : "Needs Review"}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <StatusBadge type="verification" value={report.verificationStatus} />
              </div>
            </div>
          </div>

          {/* Section: Inspection Information */}
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 pb-2 border-b border-border">
              Inspection Information
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              {[
                { label: "Inspection ID", value: inspection.id },
                { label: "Date & Time", value: formatDateTime(inspection.createdAt) },
                { label: "Inspector", value: inspection.inspectorName },
                { label: "Inspector ID", value: inspection.inspectorId },
              ].map((r) => (
                <div key={r.label}>
                  <p className="text-muted-foreground">{r.label}</p>
                  <p className="font-semibold text-foreground mt-0.5">{r.value}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Section: Product Information */}
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 pb-2 border-b border-border">
              Product Information
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              {[
                { label: "Product Name", value: product.name },
                { label: "Brand", value: product.brand },
                { label: "Category", value: product.category },
                { label: "Manufacturer / Packer", value: product.manufacturer },
                { label: "Address", value: product.address },
                { label: "Country of Origin", value: product.countryOfOrigin ?? "—" },
              ].map((r) => (
                <div key={r.label}>
                  <p className="text-muted-foreground">{r.label}</p>
                  <p className="font-medium text-foreground mt-0.5">{r.value}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Section: Package Declarations */}
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 pb-2 border-b border-border">
              Package Declarations
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              {[
                "Net Quantity", "MRP", "Manufacturing Date",
                "Best Before", "Consumer Care", "Unit Sale Price",
                "FSSAI License", "Batch / Lot Number",
              ].map((label) => (
                <div key={label}>
                  <p className="text-muted-foreground">{label}</p>
                  <p className={cn("font-medium mt-0.5", getValue(label) === "—" ? "text-red-500 italic" : "text-foreground")}>
                    {getValue(label)}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Section: Compliance Summary */}
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 pb-2 border-b border-border">
              Compliance Summary
            </h2>
            <div className="grid grid-cols-4 gap-3 mb-4">
              {[
                { label: "Passed", value: passed, color: "text-emerald-600 bg-emerald-50" },
                { label: "Violations", value: failed, color: "text-red-600 bg-red-50" },
                { label: "Review", value: review, color: "text-amber-600 bg-amber-50" },
                { label: "Total", value: complianceChecks.length, color: "text-foreground bg-muted" },
              ].map((s) => (
                <div key={s.label} className={cn("rounded-lg p-3 text-center", s.color)}>
                  <p className="text-xl font-bold">{s.value}</p>
                  <p className="text-[10px] mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Requirement</th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Value</th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {complianceChecks.map((c) => (
                    <tr key={c.id} className={cn(c.status === "fail" && "bg-red-50/30", c.status === "needs_review" && "bg-amber-50/30")}>
                      <td className="px-3 py-2 text-foreground">{c.requirement}</td>
                      <td className="px-3 py-2 text-muted-foreground">{c.value ?? "—"}</td>
                      <td className="px-3 py-2"><StatusBadge type="compliance" value={c.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Section: Violations */}
          {violations.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 pb-2 border-b border-border">
                Potential Violations
              </h2>
              <div className="space-y-3">
                {violations.map((v) => (
                  <div key={v.id} className="rounded-lg border border-red-200 bg-red-50/30 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground">{v.type}</span>
                      <StatusBadge type="severity" value={v.severity} />
                    </div>
                    <p className="text-xs text-foreground">{v.issue}</p>
                    <p className="text-[11px] text-muted-foreground">{v.explanation}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Section: Inspector Verification */}
          {verification && (
            <section>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 pb-2 border-b border-border">
                Inspector Verification
              </h2>
              <div className="grid sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <p className="text-muted-foreground">Final Decision</p>
                  <p className="font-semibold text-foreground mt-0.5 capitalize">{verification.decision.replace("_", " ")}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Verification Date</p>
                  <p className="font-medium text-foreground mt-0.5">{formatDate(verification.verifiedAt)}</p>
                </div>
                <div className="sm:col-span-1">
                  <p className="text-muted-foreground">Remarks</p>
                  <p className="text-foreground mt-0.5 leading-snug">{verification.remarks || "No remarks."}</p>
                </div>
              </div>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="bg-muted/50 border-t border-border px-6 py-4 text-[10px] text-muted-foreground leading-relaxed">
          <strong>Disclaimer:</strong> This report is generated by the Statera digital inspection system and is intended to assist Legal Metrology inspectors in their duties. The AI/OCR extracted information is for inspection assistance only. The inspector&apos;s professional verification and decision are required before any legal action. This report does not constitute a final legal order or determination. Ministry of Consumer Affairs, Food and Public Distribution — Department for Promotion of Industry and Internal Trade (DPIIT).
        </div>
      </div>
    </div>
  );
}
