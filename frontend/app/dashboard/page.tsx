"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Plus,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { mockInspections } from "@/lib/mock-data/inspections";
import { analyticsSummary, trendData, violationCategories } from "@/lib/mock-data/analytics";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDate } from "@/lib/utils";
import { fetchHistory } from "@/lib/api";
import { flaskRecordToInspection } from "@/lib/adapters";
import type { Inspection } from "@/lib/types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

export default function DashboardPage() {
  const [inspections, setInspections] = useState<Inspection[]>(mockInspections);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    fetchHistory()
      .then((records) => {
        if (records && records.length > 0) {
          const live = records.map(flaskRecordToInspection);
          // Show live records first, with mock data filling in if few
          setInspections([...live, ...mockInspections.slice(0, Math.max(0, 5 - live.length))]);
          setIsLive(true);
        }
      })
      .catch((err) => {
        console.warn("Using mock inspections fallback:", err);
      });
  }, []);

  const total = inspections.length;
  const compliant = inspections.filter((i) => i.result === "compliant").length;
  const violations = inspections.filter((i) => i.result === "potential_violation").length;
  const review = inspections.filter((i) => i.result === "needs_review").length;
  const complianceRate = total > 0 ? Math.round((compliant / total) * 100) : 0;
  const violationRate = total > 0 ? Math.round((violations / total) * 100) : 0;

  const summaryCards = [
    {
      label: "Total Inspections",
      value: total,
      icon: ClipboardCheck,
      color: "text-blue-600",
      bg: "bg-blue-50",
      change: isLive ? "Live from backend" : "+12 this month",
    },
    {
      label: "Compliant",
      value: compliant,
      icon: CheckCircle2,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      change: `${complianceRate}% rate`,
    },
    {
      label: "Potential Violations",
      value: violations,
      icon: AlertTriangle,
      color: "text-red-600",
      bg: "bg-red-50",
      change: `${violationRate}% rate`,
    },
    {
      label: "Needs Review",
      value: review,
      icon: Clock,
      color: "text-amber-600",
      bg: "bg-amber-50",
      change: "Action required",
    },
  ];

  const recentInspections = inspections.slice(0, 5);
  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Inspection Overview</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Monitor inspection activity and identify products that require attention.
          </p>
        </div>
        <Link
          href="/inspection/new"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" />
          New Inspection
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="bg-card rounded-xl border border-border p-4 lg:p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${card.bg}`}>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </div>
            <div>
              <p className="text-2xl lg:text-3xl font-bold text-foreground">{card.value}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{card.change}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Inspections */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-border">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Recent Inspections</h3>
            <Link
              href="/history"
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">ID</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Product</th>
                  <th className="hidden md:table-cell px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Result</th>
                  <th className="hidden sm:table-cell px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentInspections.map((ins) => (
                  <tr key={ins.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-muted-foreground">{ins.id}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground text-xs truncate max-w-[140px]">
                        {ins.product.name}
                      </div>
                      <div className="text-[11px] text-muted-foreground">{ins.product.brand}</div>
                    </td>
                    <td className="hidden md:table-cell px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(ins.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge type="result" value={ins.result} />
                    </td>
                    <td className="hidden sm:table-cell px-4 py-3">
                      <StatusBadge type="verification" value={ins.verificationStatus} />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/history/${ins.id}`}
                        className="text-xs text-primary hover:underline font-medium"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Common Violations */}
        <div className="bg-card rounded-xl border border-border">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Common Violations</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Most frequent potential violation types</p>
          </div>
          <div className="p-4 space-y-3">
            {violationCategories.slice(0, 6).map((v) => (
              <div key={v.name} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-foreground leading-snug">{v.name}</span>
                  <span className="text-xs font-semibold text-muted-foreground ml-2 flex-shrink-0">{v.count}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary/70 transition-all"
                    style={{ width: `${v.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Activity Chart */}
      <div className="bg-card rounded-xl border border-border">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Inspection Activity</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Monthly inspection breakdown — last 7 months</p>
          </div>
          <div className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
            <TrendingUp className="h-3.5 w-3.5" />
            +36% this month
          </div>
        </div>
        <div className="p-4 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trendData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "hsl(215 16% 47%)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "hsl(215 16% 47%)" }}
                axisLine={false}
                tickLine={false}
                width={30}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid hsl(214 32% 91%)",
                  fontSize: "12px",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              <Bar dataKey="compliant" name="Compliant" fill="#10b981" radius={[3, 3, 0, 0]} />
              <Bar dataKey="violations" name="Violations" fill="#ef4444" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label: "Start New Inspection", href: "/inspection/new", icon: Plus, color: "bg-primary text-primary-foreground" },
          { label: "View Pending Reviews", href: "/history?status=pending", icon: Clock, color: "bg-amber-50 text-amber-700 border border-amber-200" },
          { label: "Generate Reports", href: "/reports", icon: ClipboardCheck, color: "bg-muted text-foreground border border-border" },
        ].map((a) => (
          <Link
            key={a.label}
            href={a.href}
            className={`flex items-center gap-3 rounded-xl px-4 py-4 text-sm font-medium transition-all hover:opacity-90 hover:shadow-sm ${a.color}`}
          >
            <a.icon className="h-4.5 w-4.5 flex-shrink-0" />
            <span className="leading-snug">{a.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
