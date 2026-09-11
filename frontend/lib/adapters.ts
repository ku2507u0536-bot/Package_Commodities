import type {
  ExtractedField,
  ComplianceCheck,
  Inspection,
  InspectionProduct,
  InspectionResult,
  VerificationStatus,
  ProductCategory,
} from "./types";
import type { FlaskAnalyzeResponse, FlaskInspectionRecord } from "./api";

const FIELD_LABEL_MAP: Record<string, string> = {
  product_name: "Product Name",
  brand: "Brand",
  category: "Category",
  manufacturer: "Manufacturer / Packer",
  address: "Address",
  country_of_origin: "Country of Origin",
  net_quantity: "Net Quantity",
  mrp: "MRP",
  mfg_date: "Manufacturing Date",
  manufacturing_date: "Manufacturing Date",
  best_before: "Best Before",
  expiry_date: "Best Before",
  consumer_care: "Consumer Care",
  unit_sale_price: "Unit Sale Price",
  fssai_license: "FSSAI License",
  batch_number: "Batch / Lot Number",
};

export function flaskExtractedToFields(
  extractedData?: Record<string, string | null> | null
): ExtractedField[] {
  if (!extractedData) return [];

  const fieldsOrder = [
    "product_name",
    "brand",
    "category",
    "manufacturer",
    "address",
    "country_of_origin",
    "net_quantity",
    "mrp",
    "mfg_date",
    "best_before",
    "consumer_care",
    "unit_sale_price",
    "fssai_license",
    "batch_number",
  ];

  return fieldsOrder.map((key) => {
    const label = FIELD_LABEL_MAP[key] || key;
    const val = extractedData[key] ?? null;
    const isPresent = val && val.trim() !== "" && val !== "null";
    return {
      label,
      value: isPresent ? val : null,
      status: isPresent ? ("detected" as const) : ("missing" as const),
      confidence: isPresent ? 92 : 0,
    };
  });
}

export function flaskReportToChecks(
  report?: {
    field: string;
    status: string;
    rule: string;
    rule_id?: number | null;
    value?: string | null;
  }[]
): ComplianceCheck[] {
  if (!report) return [];

  return report.map((item, idx) => {
    const statusLower = item.status?.toLowerCase() || "";
    const isPass = statusLower === "present" || statusLower === "pass";
    const isReview = statusLower === "needs review" || statusLower === "review_required";
    const status = isPass ? ("pass" as const) : isReview ? ("needs_review" as const) : ("fail" as const);
    const label = FIELD_LABEL_MAP[item.field] || item.field;
    return {
      id: `check-${item.rule_id ?? idx}`,
      requirement: label,
      field: label,
      value: item.value || null,
      status,
      rule: item.rule || "Legal Metrology Rules 2011",
      detail: isPass
        ? `Mandatory declaration ${label} detected and valid.`
        : isReview
        ? `Mandatory declaration ${label} needs manual review.`
        : `Mandatory declaration ${label} is missing or incomplete.`,
    };
  });
}

export function flaskRecordToInspection(record: FlaskInspectionRecord): Inspection {
  const extracted = record.extracted_data || {};
  const statusLower = (record.status || "").toLowerCase();
  let result: InspectionResult = "compliant";
  if (statusLower.includes("non") || statusLower.includes("violation")) {
    result = "potential_violation";
  } else if (statusLower.includes("review")) {
    result = "needs_review";
  }

  const verStatus = (record.verification_status || "pending") as VerificationStatus;

  const checks: ComplianceCheck[] = (record.fields || []).map((f) => {
    const isPass = f.status?.toLowerCase() === "present";
    const label = FIELD_LABEL_MAP[f.field_name] || f.field_name;
    return {
      id: `field-${f.id}`,
      requirement: label,
      field: label,
      value: f.extracted_value,
      status: isPass ? "pass" : "fail",
      rule: f.rule?.rule_number || "Rule 6(1)",
      detail: f.rule?.rule_text,
    };
  });

  const fields = flaskExtractedToFields(extracted);

  const product: InspectionProduct = {
    name: record.product_name || extracted.product_name || "Unknown Product",
    brand: extracted.brand || "Standard Brand",
    category: (extracted.category as ProductCategory) || "Packaged Commodities",
    manufacturer: extracted.manufacturer || "Not declared",
    address: extracted.address || "Not declared",
    countryOfOrigin: extracted.country_of_origin || "India",
    netQuantity: extracted.net_quantity || null,
    mrp: extracted.mrp || null,
    manufacturingDate: extracted.mfg_date || extracted.manufacturing_date || null,
    bestBefore: extracted.best_before || extracted.expiry_date || null,
    consumerCare: extracted.consumer_care || null,
    unitSalePrice: extracted.unit_sale_price || null,
    batchNumber: extracted.batch_number || null,
    fssaiLicense: extracted.fssai_license || null,
  };

  return {
    id: `INS-${record.id}`,
    product,
    result,
    verificationStatus: verStatus,
    extractedFields: fields,
    complianceChecks: checks,
    violations: checks
      .filter((c) => c.status === "fail")
      .map((c, i) => ({
        id: `v-${record.id}-${i}`,
        type: "Missing Mandatory Declaration",
        requirement: c.requirement,
        issue: `${c.requirement} is missing from the package label`,
        field: c.field,
        evidence: "Label image analysis indicates absence of required text",
        severity: "high" as const,
        explanation: `Under ${c.rule}, every pre-packaged commodity must display ${c.requirement}.`,
      })),
    verification: record.inspector_decision
      ? {
          decision: record.inspector_decision as any,
          remarks: record.inspector_remarks || "",
          verifiedAt: record.verified_at || record.updated_at || new Date().toISOString(),
          inspectorId: record.inspector_id || "INS-001",
          inspectorName: record.inspector_name || "Inspector",
        }
      : undefined,
    createdAt: record.created_at || new Date().toISOString(),
    updatedAt: record.updated_at || new Date().toISOString(),
    inspectorId: record.inspector_id || "INS-001",
    inspectorName: record.inspector_name || "Rajesh Kumar",
    imageFileName: record.image_name || "package.jpg",
  };
}
