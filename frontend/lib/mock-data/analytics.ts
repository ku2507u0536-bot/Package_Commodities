import type {
  AnalyticsSummary,
  TrendDataPoint,
  ViolationCategory,
  CategoryDistribution,
} from "@/lib/types";

export const analyticsSummary: AnalyticsSummary = {
  totalInspections: 91,
  compliant: 54,
  potentialViolations: 27,
  needsReview: 10,
  complianceRate: 59.3,
  violationRate: 29.7,
};

export const trendData: TrendDataPoint[] = [
  { date: "May '24", inspections: 8, compliant: 5, violations: 3 },
  { date: "Jun '24", inspections: 11, compliant: 7, violations: 4 },
  { date: "Jul '24", inspections: 9, compliant: 6, violations: 3 },
  { date: "Aug '24", inspections: 14, compliant: 9, violations: 5 },
  { date: "Sep '24", inspections: 12, compliant: 7, violations: 4 },
  { date: "Oct '24", inspections: 18, compliant: 10, violations: 6 },
  { date: "Nov '24", inspections: 19, compliant: 10, violations: 2 },
];

export const violationCategories: ViolationCategory[] = [
  { name: "Missing Country of Origin", count: 12, percentage: 44 },
  { name: "Missing Manufacturing Date", count: 9, percentage: 33 },
  { name: "Missing Unit Sale Price", count: 7, percentage: 26 },
  { name: "Illegible Net Quantity", count: 5, percentage: 19 },
  { name: "Incomplete Address", count: 4, percentage: 15 },
  { name: "MRP Not Declared", count: 3, percentage: 11 },
  { name: "Missing Consumer Care", count: 2, percentage: 7 },
];

export const categoryDistribution: CategoryDistribution[] = [
  { category: "Food & Beverages", count: 28 },
  { category: "Packaged Snacks", count: 19 },
  { category: "Personal Care", count: 16 },
  { category: "Edible Oils", count: 14 },
  { category: "Household Products", count: 8 },
  { category: "Dairy Products", count: 6 },
];
