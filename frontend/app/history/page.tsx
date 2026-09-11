"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Search, Filter, X, SlidersHorizontal, Trash2 } from "lucide-react";
import { mockInspections } from "@/lib/mock-data/inspections";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatDate, cn } from "@/lib/utils";
import { fetchHistory, deleteInspection } from "@/lib/api";
import { flaskRecordToInspection } from "@/lib/adapters";
import type { Inspection, InspectionResult, VerificationStatus, ProductCategory } from "@/lib/types";

const RESULT_OPTIONS: { label: string; value: InspectionResult | "all" }[] = [
  { label: "All Results", value: "all" },
  { label: "Compliant", value: "compliant" },
  { label: "Potential Violation", value: "potential_violation" },
  { label: "Needs Review", value: "needs_review" },
];

const VERIFICATION_OPTIONS: { label: string; value: VerificationStatus | "all" }[] = [
  { label: "All Statuses", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Verified", value: "verified" },
  { label: "Violation Confirmed", value: "confirmed_violation" },
  { label: "Further Review", value: "further_review" },
];

const CATEGORY_OPTIONS: { label: string; value: ProductCategory | "all" }[] = [
  { label: "All Categories", value: "all" },
  { label: "Food & Beverages", value: "Food & Beverages" },
  { label: "Packaged Snacks", value: "Packaged Snacks" },
  { label: "Personal Care", value: "Personal Care" },
  { label: "Edible Oils", value: "Edible Oils" },
  { label: "Household Products", value: "Household Products" },
];

export default function HistoryPage() {
  const [inspections, setInspections] = useState<Inspection[]>(mockInspections);
  const [search, setSearch] = useState("");
  const [resultFilter, setResultFilter] = useState<string>("all");
  const [verificationFilter, setVerificationFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadInspections = () => {
    fetchHistory()
      .then((records) => {
        if (records && records.length > 0) {
          const live = records.map(flaskRecordToInspection);
          const existingIds = new Set(live.map((l) => l.id));
          const remainingMocks = mockInspections.filter((m) => !existingIds.has(m.id));
          setInspections([...live, ...remainingMocks]);
        }
      })
      .catch((err) => {
        console.warn("Using mock history fallback:", err);
      });
  };

  useEffect(() => {
    loadInspections();
  }, []);

  const handleDelete = async (ins: Inspection) => {
    // Only allow deleting live (backend) inspections (id format: INS-<number>)
    const match = ins.id.match(/^INS-(\d+)$/);
    if (!match) return;
    const numericId = parseInt(match[1], 10);

    if (!confirm(`Delete inspection ${ins.id} (${ins.product.name})? This cannot be undone.`)) {
      return;
    }

    setDeleting(ins.id);
    try {
      await deleteInspection(numericId);
      setInspections((prev) => prev.filter((i) => i.id !== ins.id));
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`);
    } finally {
      setDeleting(null);
    }
  };

  const filtered = useMemo(() => {
    return inspections.filter((ins) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        ins.id.toLowerCase().includes(q) ||
        ins.product.name.toLowerCase().includes(q) ||
        ins.product.brand.toLowerCase().includes(q) ||
        ins.product.manufacturer.toLowerCase().includes(q);
      const matchResult = resultFilter === "all" || ins.result === resultFilter;
      const matchVerification =
        verificationFilter === "all" || ins.verificationStatus === verificationFilter;
      const matchCategory =
        categoryFilter === "all" || ins.product.category === categoryFilter;
      return matchSearch && matchResult && matchVerification && matchCategory;
    });
  }, [inspections, search, resultFilter, verificationFilter, categoryFilter]);

  const hasFilters =
    resultFilter !== "all" ||
    verificationFilter !== "all" ||
    categoryFilter !== "all" ||
    search !== "";

  const clearFilters = () => {
    setSearch("");
    setResultFilter("all");
    setVerificationFilter("all");
    setCategoryFilter("all");
  };

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Inspection History</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Browse and search all past inspections.
          </p>
        </div>
        <Link
          href="/inspection/new"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
        >
          + New Inspection
        </Link>
      </div>

      {/* Search + Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by product, ID, or manufacturer..."
            className="w-full rounded-lg border border-border bg-card pl-9 pr-9 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors",
            showFilters ? "bg-primary text-white border-primary" : "border-border bg-card text-muted-foreground hover:bg-muted"
          )}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {hasFilters && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold">
              !
            </span>
          )}
        </button>
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="h-3 w-3" /> Clear
          </button>
        )}
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="rounded-xl border border-border bg-card p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Result", value: resultFilter, onChange: setResultFilter, options: RESULT_OPTIONS },
            { label: "Verification Status", value: verificationFilter, onChange: setVerificationFilter, options: VERIFICATION_OPTIONS },
            { label: "Category", value: categoryFilter, onChange: setCategoryFilter, options: CATEGORY_OPTIONS },
          ].map(({ label, value, onChange, options }) => (
            <div key={label}>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</label>
              <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {options.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      {/* Results count */}
      <div className="flex items-center justify-between text-sm">
        <p className="text-muted-foreground">
          Showing <span className="font-semibold text-foreground">{filtered.length}</span> of{" "}
          <span className="font-semibold text-foreground">{mockInspections.length}</span> inspections
        </p>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            title="No inspections found"
            description="No inspections match your search or filter criteria. Try adjusting your filters or start a new inspection."
            action={
              <button onClick={clearFilters} className="text-sm text-primary hover:underline">
                Clear filters
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  {["Inspection ID", "Product", "Category", "Date", "Inspector", "Result", "Verification", "Action"].map((h) => (
                    <th
                      key={h}
                      className={cn(
                        "px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider",
                        ["Category", "Inspector"].includes(h) && "hidden md:table-cell",
                        h === "Date" && "hidden sm:table-cell"
                      )}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((ins) => (
                  <tr key={ins.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-primary">{ins.id}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground text-xs">{ins.product.name}</div>
                      <div className="text-[11px] text-muted-foreground">{ins.product.brand}</div>
                    </td>
                    <td className="hidden md:table-cell px-4 py-3 text-xs text-muted-foreground">
                      {ins.product.category}
                    </td>
                    <td className="hidden sm:table-cell px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(ins.createdAt)}
                    </td>
                    <td className="hidden md:table-cell px-4 py-3 text-xs text-muted-foreground">
                      {ins.inspectorName}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge type="result" value={ins.result} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge type="verification" value={ins.verificationStatus} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/history/${ins.id}`}
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          View
                        </Link>
                        {ins.id.match(/^INS-\d+$/) && (
                          <button
                            onClick={() => handleDelete(ins)}
                            disabled={deleting === ins.id}
                            className="flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors"
                            title="Delete inspection"
                          >
                            <Trash2 className="h-3 w-3" />
                            {deleting === ins.id ? "…" : ""}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
