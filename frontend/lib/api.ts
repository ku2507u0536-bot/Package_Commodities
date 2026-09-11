// ============================================================
// STATERA — API Layer
// Connects to both the FastAPI (OCR) and Flask (compliance) backends
// ============================================================

// ─── Dynamic Base URLs (works for localhost AND remote devices over Wi-Fi) ──
export function getApiBaseUrl(): string {
  if (typeof window !== "undefined" && window.location.hostname) {
    return `http://${window.location.hostname}:8000`;
  }
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
}

export function getFlaskApiUrl(): string {
  // Compliance (Regex -> Rule Engine -> Supabase) now lives on the same
  // FastAPI backend as OCR (see backend/main.py: /inspection/analyze-text).
  // Kept as a separate function name to avoid touching every call site.
  return getApiBaseUrl();
}

export const API_BASE_URL = getApiBaseUrl();
export const FLASK_API_URL = getFlaskApiUrl();

// ──────────────────────────────────────────────────────────────
// OCR Types & Functions (FastAPI)
// ──────────────────────────────────────────────────────────────

export interface OcrDetailItem {
  text: string;
  confidence: number;
}

export interface OcrApiResponse {
  success: boolean;
  text: string;
  ocr_details: OcrDetailItem[];
  total_lines_detected: number;
  original_image: {
    filename: string;
    width: number;
    height: number;
    size_bytes: number;
    url: string;
  };
  processed_image: {
    filename: string;
    width: number;
    height: number;
    url: string;
  };
}

export async function performOCR(file: File): Promise<OcrApiResponse> {
  const baseUrl = getApiBaseUrl();
  const endpoint = `${baseUrl.replace(/\/$/, "")}/inspection/ocr`;

  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      body: formData,
      // Note: Do NOT set Content-Type header manually for FormData!
    });

    if (!res.ok) {
      const errData = await res
        .json()
        .catch(() => ({ detail: `Server error ${res.status}` }));
      throw new Error(
        errData.detail || `Backend returned error ${res.status}`
      );
    }

    const data: OcrApiResponse = await res.json();
    return data;
  } catch (error: any) {
    // Try graceful fallback to Flask /analyze endpoint if FastAPI is down
    try {
      const flaskUrl = getFlaskApiUrl();
      const flaskEndpoint = `${flaskUrl.replace(/\/$/, "")}/analyze`;
      const flaskForm = new FormData();
      flaskForm.append("image", file);
      const fRes = await fetch(flaskEndpoint, {
        method: "POST",
        body: flaskForm,
      });
      if (fRes.ok) {
        const flaskData: FlaskAnalyzeResponse = await fRes.json();
        const detectedEntries = Object.entries(flaskData.extracted_data || {}).filter(([_, v]) => !!v);
        const ocrText = detectedEntries.map(([k, v]) => `${k.toUpperCase().replace(/_/g, " ")}: ${v}`).join("\n");
        return {
          success: true,
          text: ocrText || "Product label analyzed",
          ocr_details: detectedEntries.map(([k, v]) => ({
            text: `${k.toUpperCase().replace(/_/g, " ")}: ${v}`,
            confidence: 0.98,
          })),
          total_lines_detected: detectedEntries.length,
          original_image: {
            filename: file.name,
            width: 800,
            height: 600,
            size_bytes: file.size,
            url: URL.createObjectURL(file),
          },
          processed_image: {
            filename: file.name,
            width: 800,
            height: 600,
            url: URL.createObjectURL(file),
          },
        };
      }
    } catch {
      // Fall through to throw standard error
    }

    if (
      error instanceof TypeError ||
      error.message?.includes("fetch") ||
      error.message?.includes("Failed to fetch")
    ) {
      throw new Error(
        `Backend server is unavailable at ${baseUrl}. Please ensure the FastAPI backend is running.`
      );
    }
    throw error;
  }
}

// ──────────────────────────────────────────────────────────────
// Flask Compliance Types & Functions
// ──────────────────────────────────────────────────────────────

/** Response from Flask /analyze-text endpoint */
export interface FlaskComplianceField {
  field: string;
  status: "Present" | "Missing";
  rule: string;
  rule_id: number | null;
  value: string | null;
}

export interface FlaskAnalyzeResponse {
  id: number;
  image_name: string;
  extracted_data: Record<string, string | null>;
  compliance_report: FlaskComplianceField[];
  score: number;
  status: string; // "Compliant" | "Needs Review" | "Non-Compliant"
  verification_status: string;
  created_at: string;
}

/** Response from Flask /history endpoint */
export interface FlaskInspectionRecord {
  id: number;
  product_name: string | null;
  image_name: string;
  raw_ocr_text: string | null;
  extracted_data: Record<string, string | null> | null;
  score: number;
  status: string;
  verification_status: string;
  inspector_decision: string | null;
  inspector_remarks: string | null;
  inspector_name: string | null;
  inspector_id: string | null;
  verified_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  fields: {
    id: number;
    inspection_id: number;
    field_name: string;
    extracted_value: string | null;
    status: string;
    rule_id: number | null;
    rule: {
      id: number;
      field_name: string;
      rule_number: string;
      rule_text: string;
      category: string | null;
    } | null;
  }[];
}

/** Response from Flask /rules endpoint */
export interface FlaskRule {
  id: number;
  field_name: string;
  rule_number: string;
  rule_text: string;
  category: string | null;
}

// ─── Flask API Functions ─────────────────────────────────────

/**
 * Send raw OCR text to Flask for structuring + compliance checking.
 * This is the bridge between FastAPI OCR output and Flask compliance engine.
 */
export async function analyzeText(
  rawText: string,
  imageName: string = "ocr_upload.jpg"
): Promise<FlaskAnalyzeResponse> {
  const flaskUrl = getFlaskApiUrl();
  const endpoint = `${flaskUrl.replace(/\/$/, "")}/analyze-text`;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw_text: rawText, image_name: imageName }),
    });

    if (!res.ok) {
      const errData = await res
        .json()
        .catch(() => ({ error: `Server error ${res.status}` }));
      throw new Error(
        errData.error || `Flask backend returned error ${res.status}`
      );
    }

    return await res.json();
  } catch (error: any) {
    if (
      error instanceof TypeError ||
      error.message?.includes("fetch") ||
      error.message?.includes("Failed to fetch")
    ) {
      throw new Error(
        `Flask backend is unavailable at ${flaskUrl}. Please ensure the Flask server is running.`
      );
    }
    throw error;
  }
}

/**
 * Fetch all past inspections from Flask.
 */
export async function fetchHistory(): Promise<FlaskInspectionRecord[]> {
  const flaskUrl = getFlaskApiUrl();
  const endpoint = `${flaskUrl.replace(/\/$/, "")}/history`;

  try {
    const res = await fetch(endpoint);
    if (!res.ok) {
      const errData = await res
        .json()
        .catch(() => ({ error: `Server error ${res.status}` }));
      throw new Error(errData.error || `Failed to fetch history`);
    }
    return await res.json();
  } catch (error: any) {
    if (
      error instanceof TypeError ||
      error.message?.includes("fetch") ||
      error.message?.includes("Failed to fetch")
    ) {
      throw new Error(
        `Flask backend is unavailable at ${flaskUrl}. Cannot fetch inspection history.`
      );
    }
    throw error;
  }
}

/**
 * Fetch a single inspection by ID.
 */
export async function fetchInspection(
  id: number
): Promise<FlaskInspectionRecord> {
  const flaskUrl = getFlaskApiUrl();
  const endpoint = `${flaskUrl.replace(/\/$/, "")}/inspections/${id}`;

  const res = await fetch(endpoint);
  if (!res.ok) {
    const errData = await res
      .json()
      .catch(() => ({ error: `Server error ${res.status}` }));
    throw new Error(errData.error || `Failed to fetch inspection ${id}`);
  }
  return await res.json();
}

/**
 * Fetch all compliance rules from Flask.
 */
export async function fetchRules(): Promise<FlaskRule[]> {
  const flaskUrl = getFlaskApiUrl();
  const endpoint = `${flaskUrl.replace(/\/$/, "")}/rules`;

  try {
    const res = await fetch(endpoint);
    if (!res.ok) {
      const errData = await res
        .json()
        .catch(() => ({ error: `Server error ${res.status}` }));
      throw new Error(errData.error || `Failed to fetch rules`);
    }
    return await res.json();
  } catch (error: any) {
    if (
      error instanceof TypeError ||
      error.message?.includes("fetch") ||
      error.message?.includes("Failed to fetch")
    ) {
      throw new Error(
        `Flask backend is unavailable at ${flaskUrl}. Cannot fetch rules.`
      );
    }
    throw error;
  }
}

/**
 * Submit inspector verification decision for an inspection.
 */
export async function submitVerification(
  inspectionId: number,
  decision: string,
  remarks: string,
  inspectorName: string = "Inspector",
  inspectorId: string = "INS-000"
): Promise<FlaskInspectionRecord> {
  const flaskUrl = getFlaskApiUrl();
  const endpoint = `${flaskUrl.replace(
    /\/$/,
    ""
  )}/inspections/${inspectionId}/verify`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      decision,
      remarks,
      inspector_name: inspectorName,
      inspector_id: inspectorId,
    }),
  });

  if (!res.ok) {
    const errData = await res
      .json()
      .catch(() => ({ error: `Server error ${res.status}` }));
    throw new Error(errData.error || `Failed to submit verification`);
  }
  return await res.json();
}

/**
 * Check Flask backend health.
 */
export async function checkFlaskHealth(): Promise<boolean> {
  try {
    const flaskUrl = getFlaskApiUrl();
    const res = await fetch(
      `${flaskUrl.replace(/\/$/, "")}/health`
    );
    return res.ok;
  } catch {
    return false;
  }
}

// ──────────────────────────────────────────────────────────────
// Analytics Types & Functions
// ──────────────────────────────────────────────────────────────

export interface FlaskAnalyticsSummary {
  totalInspections: number;
  compliant: number;
  potentialViolations: number;
  needsReview: number;
  complianceRate: number;
  violationRate: number;
}

export interface FlaskTrendDataPoint {
  date: string;
  inspections: number;
  compliant: number;
  violations: number;
}

export interface FlaskViolationCategory {
  name: string;
  count: number;
  percentage: number;
}

export interface FlaskAnalyticsResponse {
  summary: FlaskAnalyticsSummary;
  trendData: FlaskTrendDataPoint[];
  violationCategories: FlaskViolationCategory[];
}

/**
 * Fetch computed analytics from Flask backend.
 */
export async function fetchAnalytics(): Promise<FlaskAnalyticsResponse> {
  const flaskUrl = getFlaskApiUrl();
  const endpoint = `${flaskUrl.replace(/\/$/, "")}/analytics`;

  try {
    const res = await fetch(endpoint);
    if (!res.ok) {
      const errData = await res
        .json()
        .catch(() => ({ error: `Server error ${res.status}` }));
      throw new Error(errData.error || `Failed to fetch analytics`);
    }
    return await res.json();
  } catch (error: any) {
    if (
      error instanceof TypeError ||
      error.message?.includes("fetch") ||
      error.message?.includes("Failed to fetch")
    ) {
      throw new Error(
        `Flask backend is unavailable at ${flaskUrl}. Cannot fetch analytics.`
      );
    }
    throw error;
  }
}

// ──────────────────────────────────────────────────────────────
// Reports Types & Functions
// ──────────────────────────────────────────────────────────────

export interface FlaskReportRecord {
  id: string;
  inspectionId: string;
  product: string;
  category: string;
  result: string;
  score: number;
  verificationStatus: string;
  generatedAt: string | null;
  inspectorName: string;
  fields: {
    id: number;
    inspection_id: number;
    field_name: string;
    extracted_value: string | null;
    status: string;
    rule_id: number | null;
    rule: {
      id: number;
      field_name: string;
      rule_number: string;
      rule_text: string;
      category: string | null;
    } | null;
  }[];
}

/**
 * Fetch all reports from Flask backend.
 */
export async function fetchReports(): Promise<FlaskReportRecord[]> {
  const flaskUrl = getFlaskApiUrl();
  const endpoint = `${flaskUrl.replace(/\/$/, "")}/reports`;

  try {
    const res = await fetch(endpoint);
    if (!res.ok) {
      const errData = await res
        .json()
        .catch(() => ({ error: `Server error ${res.status}` }));
      throw new Error(errData.error || `Failed to fetch reports`);
    }
    return await res.json();
  } catch (error: any) {
    if (
      error instanceof TypeError ||
      error.message?.includes("fetch") ||
      error.message?.includes("Failed to fetch")
    ) {
      throw new Error(
        `Flask backend is unavailable at ${flaskUrl}. Cannot fetch reports.`
      );
    }
    throw error;
  }
}

// ──────────────────────────────────────────────────────────────
// Delete Inspection
// ──────────────────────────────────────────────────────────────

/**
 * Delete an inspection by ID.
 */
export async function deleteInspection(
  inspectionId: number
): Promise<{ message: string }> {
  const flaskUrl = getFlaskApiUrl();
  const endpoint = `${flaskUrl.replace(
    /\/$/,
    ""
  )}/inspections/${inspectionId}`;

  const res = await fetch(endpoint, { method: "DELETE" });
  if (!res.ok) {
    const errData = await res
      .json()
      .catch(() => ({ error: `Server error ${res.status}` }));
    throw new Error(errData.error || `Failed to delete inspection ${inspectionId}`);
  }
  return await res.json();
}
