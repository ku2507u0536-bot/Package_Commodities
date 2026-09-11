// ============================================================
// STATERA — Core Types
// ============================================================

export type InspectionResult = "compliant" | "potential_violation" | "needs_review";
export type VerificationStatus = "pending" | "verified" | "confirmed_violation" | "further_review";
export type FieldStatus = "detected" | "needs_review" | "missing";
export type SeverityLevel = "low" | "medium" | "high";
export type ProductCategory =
  | "Food & Beverages"
  | "Personal Care"
  | "Household Products"
  | "Packaged Commodities"
  | "Edible Oils"
  | "Dairy Products"
  | "Packaged Snacks";

export interface ExtractedField {
  label: string;
  value: string | null;
  status: FieldStatus;
  confidence?: number;
  edited?: boolean;
}

export interface ComplianceCheck {
  id: string;
  requirement: string;
  field: string;
  value: string | null;
  status: "pass" | "fail" | "needs_review";
  rule: string;
  detail?: string;
}

export interface Violation {
  id: string;
  type: string;
  requirement: string;
  issue: string;
  field: string;
  evidence: string;
  severity: SeverityLevel;
  explanation: string;
  inspectorNote?: string;
}

export interface InspectionProduct {
  name: string;
  brand: string;
  category: ProductCategory;
  imageUrl?: string;
  manufacturer: string;
  address: string;
  countryOfOrigin: string | null;
  netQuantity: string | null;
  mrp: string | null;
  manufacturingDate: string | null;
  bestBefore: string | null;
  consumerCare: string | null;
  unitSalePrice: string | null;
  batchNumber?: string | null;
  fssaiLicense?: string | null;
  barcode?: string | null;
}

export interface InspectorVerification {
  decision: "compliant" | "confirmed_violation" | "further_review";
  remarks: string;
  verifiedAt: string;
  inspectorId: string;
  inspectorName: string;
}

export interface Inspection {
  id: string;
  product: InspectionProduct;
  result: InspectionResult;
  verificationStatus: VerificationStatus;
  extractedFields: ExtractedField[];
  complianceChecks: ComplianceCheck[];
  violations: Violation[];
  verification?: InspectorVerification;
  createdAt: string;
  updatedAt: string;
  inspectorId: string;
  inspectorName: string;
  imageFileName: string;
  reportId?: string;
}

export interface Report {
  id: string;
  inspectionId: string;
  product: string;
  category: ProductCategory;
  result: InspectionResult;
  verificationStatus: VerificationStatus;
  generatedAt: string;
  inspectorName: string;
}

export interface AnalyticsSummary {
  totalInspections: number;
  compliant: number;
  potentialViolations: number;
  needsReview: number;
  complianceRate: number;
  violationRate: number;
}

export interface TrendDataPoint {
  date: string;
  inspections: number;
  compliant: number;
  violations: number;
}

export interface ViolationCategory {
  name: string;
  count: number;
  percentage: number;
}

export interface CategoryDistribution {
  category: string;
  count: number;
}

export interface ComplianceRequirement {
  id: string;
  category: string;
  name: string;
  explanation: string;
  applicableField: string;
  example: string;
  ruleReference: string;
  mandatory: boolean;
}
