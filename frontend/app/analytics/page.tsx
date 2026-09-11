"use client";

import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";
import {
  analyticsSummary as defaultSummary,
  trendData as defaultTrendData,
  violationCategories as defaultViolationCategories,
  categoryDistribution,
} from "@/lib/mock-data/analytics";
import { ClipboardCheck, CheckCircle2, AlertTriangle, Clock, Database } from "lucide-react";
import { fetchAnalytics, type FlaskTrendDataPoint, type FlaskViolationCategory } from "@/lib/api";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

export default function AnalyticsPage() {
  const [summary, setSummary] = useState(defaultSummary);
  const [trend, setTrend] = useState<FlaskTrendDataPoint[]>(defaultTrendData);
  const [violations, setViolations] = useState<FlaskViolationCategory[]>(
    defaultViolationCategories.map((v) => ({
      name: v.name,
      count: v.count,
      percentage: v.percentage,
    }))
  );
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    fetchAnalytics()
      .then((data) => {
        if (data) {
          setSummary(data.summary);
          if (data.trendData && data.trendData.length > 0) {
            setTrend(data.trendData);
          }
          if (data.violationCategories && data.violationCategories.length > 0) {
            setViolations(data.violationCategories);
          }
          setIsLive(true);
        }
      })
      .catch((err) => {
        console.warn("Using default analytics fallback:", err);
      });
  }, []);

  const complianceData = [
    { name: "Compliant", value: summary.compliant },
    { name: "Potential Violation", value: summary.potentialViolations },
    { name: "Needs Review", value: summary.needsReview },
  ];
  const complianceColors = ["#10b981", "#ef4444", "#f59e0b"];

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Analytics</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isLive
              ? "Live inspection metrics and compliance rates from database."
              : "Inspection data analysis and trends. Based on demo data."}
          </p>
        </div>
        {isLive && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Database className="h-3.5 w-3.5 text-emerald-600" />
            Live Data ({summary.totalInspections} Inspections)
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Total Inspections",
            value: summary.totalInspections,
            icon: ClipboardCheck,
            color: "text-blue-600",
            bg: "bg-blue-50",
            sub: isLive ? "Live from database" : "All time",
          },
          {
            label: "Compliance Rate",
            value: `${summary.complianceRate}%`,
            icon: CheckCircle2,
            color: "text-emerald-600",
            bg: "bg-emerald-50",
            sub: `${summary.compliant} compliant`,
          },
          {
            label: "Violation Rate",
            value: `${summary.violationRate}%`,
            icon: AlertTriangle,
            color: "text-red-600",
            bg: "bg-red-50",
            sub: `${summary.potentialViolations} potential violations`,
          },
          {
            label: "Needs Review",
            value: summary.needsReview,
            icon: Clock,
            color: "text-amber-600",
            bg: "bg-amber-50",
            sub: "Awaiting inspection",
          },
        ].map((c) => (
          <div key={c.label} className="bg-card rounded-xl border border-border p-4 lg:p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground">{c.label}</p>
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${c.bg}`}>
                <c.icon className={`h-4 w-4 ${c.color}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">{c.value}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Inspection Trend */}
        <div className="bg-card rounded-xl border border-border">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Inspection Trend</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {isLive ? "Monthly inspections from database" : "Monthly inspections — last 7 months"}
            </p>
          </div>
          <div className="p-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(215 16% 47%)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(215 16% 47%)" }} axisLine={false} tickLine={false} width={30} />
                <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid hsl(214 32% 91%)", fontSize: "12px" }} />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                <Line type="monotone" dataKey="inspections" name="Total" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="compliant" name="Compliant" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="violations" name="Violations" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Compliance vs violations pie */}
        <div className="bg-card rounded-xl border border-border">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Compliance Distribution</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Overall breakdown of inspection results</p>
          </div>
          <div className="p-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={complianceData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {complianceData.map((entry, index) => (
                    <Cell key={entry.name} fill={complianceColors[index]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid hsl(214 32% 91%)", fontSize: "12px" }} />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Common violation categories */}
        <div className="bg-card rounded-xl border border-border">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Common Violation Categories</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {isLive ? "Field-level missing declarations from database" : "Most frequent potential violation types"}
            </p>
          </div>
          <div className="p-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={violations}
                layout="vertical"
                margin={{ left: 20, right: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(215 16% 47%)" }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "hsl(215 16% 47%)" }}
                  axisLine={false}
                  tickLine={false}
                  width={160}
                />
                <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid hsl(214 32% 91%)", fontSize: "12px" }} />
                <Bar dataKey="count" name="Count" fill="#ef4444" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category distribution */}
        <div className="bg-card rounded-xl border border-border">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Product Category Distribution</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Inspections by product category</p>
          </div>
          <div className="p-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" vertical={false} />
                <XAxis dataKey="category" tick={{ fontSize: 9, fill: "hsl(215 16% 47%)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(215 16% 47%)" }} axisLine={false} tickLine={false} width={30} />
                <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid hsl(214 32% 91%)", fontSize: "12px" }} />
                <Bar dataKey="count" name="Inspections" radius={[3, 3, 0, 0]}>
                  {categoryDistribution.map((entry, index) => (
                    <Cell key={entry.category} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
