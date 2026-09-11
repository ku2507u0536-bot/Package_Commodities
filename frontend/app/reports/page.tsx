"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Download, Eye, FileText, Database } from "lucide-react";
import { mockReports } from "@/lib/mock-data/reports";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDate } from "@/lib/utils";
import { fetchReports, type FlaskReportRecord } from "@/lib/api";
import type { Report, InspectionResult, VerificationStatus } from "@/lib/types";

function flaskReportToFrontend(r: FlaskReportRecord): Report {
  const statusLower = (r.result || "").toLowerCase();
  let result: InspectionResult = "compliant";
  if (statusLower.includes("non") || statusLower.includes("violation")) {
    result = "potential_violation";
  } else if (statusLower.includes("review")) {
    result = "needs_review";
  }

  const verStatus = (r.verificationStatus || "pending") as VerificationStatus;

  return {
    id: r.id,
    inspectionId: r.inspectionId,
    product: r.product || "Unknown Product",
    category: (r.category || "Packaged Commodities") as any,
    result,
    verificationStatus: verStatus,
    generatedAt: r.generatedAt || new Date().toISOString(),
    inspectorName: r.inspectorName || "Inspector",
  };
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>(mockReports);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    fetchReports()
      .then((data) => {
        if (data && data.length > 0) {
          const liveReports = data.map(flaskReportToFrontend);
          setReports(liveReports);
          setIsLive(true);
        }
      })
      .catch((err) => {
        console.warn("Using mock reports fallback:", err);
      });
  }, []);

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Reports</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            View and download inspection reports.
          </p>
        </div>
        {isLive && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Database className="h-3.5 w-3.5 text-emerald-600" />
            Live Data ({reports.length} Reports)
          </div>
        )}
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {["Report ID", "Inspection ID", "Product", "Date", "Result", "Verification", "Actions"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {reports.map((report) => (
                <tr key={report.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-primary">{report.id}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/history/${report.inspectionId}`} className="font-mono text-xs text-muted-foreground hover:text-primary hover:underline">
                      {report.inspectionId}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs font-medium text-foreground truncate max-w-[200px]">{report.product}</p>
                    <p className="text-[11px] text-muted-foreground">{report.category}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(report.generatedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge type="result" value={report.result} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge type="verification" value={report.verificationStatus} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/reports/${report.id}`}
                        className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        <Eye className="h-3 w-3" /> View
                      </Link>
                      <button className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                        <Download className="h-3 w-3" /> PDF
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
