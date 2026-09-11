"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  Eye,
  Cpu,
  FileText,
  ShieldCheck,
  ClipboardCheck,
  FileDown,
  Check,
  ChevronLeft,
  ChevronRight,
  X,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Pencil,
  Save,
  Download,
  Info,
  Camera,
} from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { cn, formatDateTime } from "@/lib/utils";
import type { ExtractedField, ComplianceCheck, Violation } from "@/lib/types";
import {
  performOCR,
  analyzeText,
  submitVerification,
  type OcrApiResponse,
  type FlaskAnalyzeResponse,
  API_BASE_URL,
  FLASK_API_URL,
} from "@/lib/api";
import {
  flaskExtractedToFields,
  flaskReportToChecks,
} from "@/lib/adapters";
import { parseOcrTextClientSide } from "@/lib/client-parser";

// ──────────────────────────────────────────────────────
// Step configuration
// ──────────────────────────────────────────────────────
const STEPS = [
  { id: 1, label: "Upload", icon: Upload },
  { id: 2, label: "Review", icon: Eye },
  { id: 3, label: "Analysis", icon: Cpu },
  { id: 4, label: "Extracted", icon: FileText },
  { id: 5, label: "Compliance", icon: ShieldCheck },
  { id: 6, label: "Verification", icon: ClipboardCheck },
  { id: 7, label: "Report", icon: FileDown },
];

// ──────────────────────────────────────────────────────
// Mock extracted data for the new inspection
// ──────────────────────────────────────────────────────
const MOCK_EXTRACTED: ExtractedField[] = [
  { label: "Product Name", value: "Whole Wheat Atta", status: "detected", confidence: 96 },
  { label: "Brand", value: "Aashirvaad", status: "detected", confidence: 98 },
  { label: "Category", value: "Food & Beverages", status: "detected", confidence: 95 },
  { label: "Manufacturer / Packer", value: "ITC Limited", status: "detected", confidence: 97 },
  { label: "Address", value: "Virginia House, 37, J.L.Nehru Road, Kolkata - 700 071", status: "detected", confidence: 91 },
  { label: "Country of Origin", value: "India", status: "detected", confidence: 99 },
  { label: "Net Quantity", value: "5 kg", status: "detected", confidence: 98 },
  { label: "MRP", value: "₹275 (Inclusive of all taxes)", status: "detected", confidence: 97 },
  { label: "Manufacturing Date", value: "September 2024", status: "detected", confidence: 93 },
  { label: "Best Before", value: "6 months from manufacture", status: "detected", confidence: 90 },
  { label: "Consumer Care", value: "1800-XXX-XXXX | ashirvaad@itc.in", status: "detected", confidence: 87 },
  { label: "Unit Sale Price", value: "₹55 per kg", status: "detected", confidence: 85 },
  { label: "FSSAI License", value: "10013022000099", status: "detected", confidence: 93 },
  { label: "Batch / Lot Number", value: "AW-SEP24-11", status: "needs_review", confidence: 60 },
];

const MOCK_COMPLIANCE: ComplianceCheck[] = [
  { id: "nc1", requirement: "Product Name", field: "Product Name", value: "Whole Wheat Atta", status: "pass", rule: "Rule 6(1)(a)" },
  { id: "nc2", requirement: "Net Quantity", field: "Net Quantity", value: "5 kg", status: "pass", rule: "Rule 6(1)(b)" },
  { id: "nc3", requirement: "MRP Declaration", field: "MRP", value: "₹275", status: "pass", rule: "Rule 6(1)(d)" },
  { id: "nc4", requirement: "Manufacturer/Packer Details", field: "Manufacturer / Packer", value: "ITC Limited", status: "pass", rule: "Rule 6(1)(c)" },
  { id: "nc5", requirement: "Country of Origin", field: "Country of Origin", value: "India", status: "pass", rule: "Rule 6(1)(e)" },
  { id: "nc6", requirement: "Manufacturing Date", field: "Manufacturing Date", value: "September 2024", status: "pass", rule: "Rule 6(1)(f)" },
  { id: "nc7", requirement: "Best Before/Expiry", field: "Best Before", value: "6 months", status: "pass", rule: "Rule 6(1)(f)" },
  { id: "nc8", requirement: "Consumer Care Details", field: "Consumer Care", value: "Present", status: "pass", rule: "Rule 6(1)(g)" },
  { id: "nc9", requirement: "Unit Sale Price (>100g)", field: "Unit Sale Price", value: "₹55 per kg", status: "pass", rule: "Rule 6(1)(h)" },
  { id: "nc10", requirement: "Batch / Lot Number legibility", field: "Batch / Lot Number", value: "Low confidence", status: "needs_review", rule: "FSS Regulations 2020", detail: "Batch number detected with low confidence. Inspector should verify legibility." },
];

// ──────────────────────────────────────────────────────
// Step Indicator
// ──────────────────────────────────────────────────────
function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center w-full mb-8 overflow-x-auto pb-2">
      {STEPS.map((step, idx) => {
        const done = currentStep > step.id;
        const active = currentStep === step.id;
        const Icon = step.icon;
        return (
          <div key={step.id} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center flex-shrink-0">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all",
                  done
                    ? "bg-primary border-primary text-white"
                    : active
                    ? "border-primary text-primary bg-primary/10"
                    : "border-border text-muted-foreground bg-card"
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
              </div>
              <span
                className={cn(
                  "mt-1.5 text-[10px] font-medium hidden sm:block whitespace-nowrap",
                  active ? "text-primary" : done ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={cn(
                  "flex-1 h-0.5 mx-1 sm:mx-2 transition-all",
                  done ? "bg-primary" : "bg-border"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ──────────────────────────────────────────────────────
// Step 1 — Upload
// ──────────────────────────────────────────────────────
function Step1Upload({
  image,
  onImage,
  onNext,
}: {
  image: { file: File; url: string } | null;
  onImage: (img: { file: File; url: string } | null) => void;
  onNext: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const handleFile = (file: File) => {
    const url = URL.createObjectURL(file);
    onImage({ file, url });
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("image/")) handleFile(file);
    },
    []
  );

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
    setCameraLoading(false);
    setCameraError(null);
  }, []);

  const startCamera = async (mode: "user" | "environment" = facingMode) => {
    setIsCameraOpen(true);
    setCameraLoading(true);
    setCameraError(null);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Webcam access is not supported by your browser.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraLoading(false);
    } catch (err: any) {
      console.error("Camera access error:", err);
      setCameraLoading(false);
      setCameraError(
        err.message ||
          "Unable to access camera. Please allow camera permissions in your browser or try browsing for an image."
      );
    }
  };

  useEffect(() => {
    if (isCameraOpen && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [isCameraOpen]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const toggleFacingMode = () => {
    const nextMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const capturedFile = new File([blob], `camera-capture-${Date.now()}.jpg`, {
              type: "image/jpeg",
            });
            handleFile(capturedFile);
            stopCamera();
          }
        },
        "image/jpeg",
        0.95
      );
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">Upload Product Image</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Upload a clear photograph of the product label or package. The system will extract package information for compliance analysis.
        </p>
      </div>

      {!image ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={cn(
            "border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer",
            dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/50"
          )}
          onClick={() => document.getElementById("file-input")?.click()}
        >
          <input
            id="file-input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Upload className="h-7 w-7 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Drag and drop or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">
                Accepted formats: JPEG, PNG, WEBP · Max 10 MB
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  document.getElementById("file-input")?.click();
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
              >
                <Upload className="h-4 w-4" />
                Browse Image
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  startCamera();
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <Camera className="h-4 w-4" />
                Capture
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="bg-muted/50 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-medium text-foreground">Image selected</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => document.getElementById("file-input-replace")?.click()}
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors border border-border"
              >
                <RefreshCw className="h-3 w-3" />
                Replace
              </button>
              <button
                onClick={() => onImage(null)}
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors border border-red-200"
              >
                <X className="h-3 w-3" />
                Remove
              </button>
              <input
                id="file-input-replace"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </div>
          </div>
          <div className="flex gap-4 p-4">
            <div className="flex-shrink-0 w-40 h-40 rounded-lg overflow-hidden border border-border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.url}
                alt="Selected product"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 space-y-2">
              <div>
                <p className="text-[11px] text-muted-foreground">File name</p>
                <p className="text-sm font-medium text-foreground truncate">{image.file.name}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">File size</p>
                <p className="text-sm font-medium text-foreground">
                  {(image.file.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Type</p>
                <p className="text-sm font-medium text-foreground">{image.file.type}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Webcam Camera Modal */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-card border border-border overflow-hidden shadow-2xl space-y-0">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-card">
              <div className="flex items-center gap-2">
                <Camera className="h-5 w-5 text-primary" />
                <h3 className="text-base font-semibold text-foreground">Capture Product Photo</h3>
              </div>
              <button
                onClick={stopCamera}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Video Feed / Error Container */}
            <div className="relative bg-black aspect-video flex items-center justify-center overflow-hidden">
              {cameraLoading && (
                <div className="flex flex-col items-center gap-2 text-white">
                  <RefreshCw className="h-7 w-7 animate-spin text-primary" />
                  <span className="text-xs">Initializing webcam...</span>
                </div>
              )}

              {cameraError ? (
                <div className="p-6 text-center text-white space-y-3">
                  <AlertTriangle className="h-10 w-10 text-red-500 mx-auto" />
                  <p className="text-xs text-red-200 max-w-xs mx-auto">{cameraError}</p>
                  <button
                    onClick={() => startCamera()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Try Again
                  </button>
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  {/* Viewfinder crosshair overlay */}
                  <div className="absolute inset-8 border-2 border-dashed border-white/60 rounded-lg pointer-events-none flex items-center justify-center">
                    <span className="bg-black/50 text-white text-[10px] px-2.5 py-1 rounded backdrop-blur-sm">
                      Align product package within frame
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Controls */}
            <div className="p-4 bg-card border-t border-border flex items-center justify-between gap-3">
              <button
                onClick={toggleFacingMode}
                disabled={!!cameraError || cameraLoading}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Switch Camera
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={stopCamera}
                  className="rounded-lg border border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={capturePhoto}
                  disabled={!!cameraError || cameraLoading}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm"
                >
                  <Camera className="h-4 w-4" /> Snap Photo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 flex gap-3">
        <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700">
          For best results, ensure the label is well-lit, in focus, and all text is legible. Capture the primary information panel of the package.
        </p>
      </div>

      <div className="flex justify-end">
        <button
          onClick={onNext}
          disabled={!image}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
        >
          Continue <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────
// Step 2 — Image Review
// ──────────────────────────────────────────────────────
function Step2Review({
  image,
  onBack,
  onNext,
}: {
  image: { file: File; url: string } | null;
  onBack: () => void;
  onNext: () => void;
}) {
  if (!image) return null;
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">Review Image</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Verify the image quality before proceeding to AI/OCR analysis. Ensure the label text is legible.
        </p>
      </div>
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 rounded-xl border border-border overflow-hidden bg-muted/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.url}
            alt="Product image preview"
            className="w-full object-contain max-h-96"
          />
        </div>
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Image Information</h3>
            {[
              { label: "File name", value: image.file.name },
              { label: "File size", value: `${(image.file.size / 1024).toFixed(1)} KB` },
              { label: "Upload time", value: new Date().toLocaleTimeString("en-IN") },
              { label: "Image status", value: "Ready for analysis" },
            ].map((r) => (
              <div key={r.label} className="flex flex-col gap-0.5">
                <p className="text-[11px] text-muted-foreground">{r.label}</p>
                <p className="text-xs font-medium text-foreground">{r.value}</p>
              </div>
            ))}
          </div>
          <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-3 flex gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-emerald-700">Image is ready. Proceed to analysis when ready.</p>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        <button
          onClick={onNext}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
        >
          Continue to Analysis <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────
// Step 3 — AI/OCR Analysis (Simulation)
// ──────────────────────────────────────────────────────
const STAGES = [
  { label: "Image uploaded & validated" },
  { label: "OpenCV Preprocessing (Noise reduction & Grayscale)" },
  { label: "PaddleOCR Text Detection & Recognition (FastAPI :8000)" },
  { label: "Legal Metrology Structuring & Compliance Analysis (Flask :5000)" },
];

function Step3Analysis({
  image,
  ocrResult,
  flaskResult,
  onOcrResult,
  onFlaskResult,
  onClientExtracted,
  onBack,
  onNext,
}: {
  image: { file: File; url: string } | null;
  ocrResult: OcrApiResponse | null;
  flaskResult: FlaskAnalyzeResponse | null;
  onOcrResult: (result: OcrApiResponse) => void;
  onFlaskResult: (result: FlaskAnalyzeResponse) => void;
  onClientExtracted?: (fields: ExtractedField[], checks: ComplianceCheck[]) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [running, setRunning] = useState(false);
  const [stageIdx, setStageIdx] = useState(ocrResult ? 3 : -1);
  const [done, setDone] = useState(!!ocrResult);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ocrResult) {
      setDone(false);
      setStageIdx(-1);
    }
  }, [ocrResult]);

  const startAnalysis = async () => {
    if (!image) {
      setError("No product image selected. Please go back and upload an image.");
      return;
    }

    setRunning(true);
    setError(null);
    setStageIdx(0);

    try {
      // Stage 1: Uploading image to backend
      await new Promise((r) => setTimeout(r, 300));
      setStageIdx(1);

      // Stage 2: OpenCV + PaddleOCR Processing on FastAPI Backend
      setStageIdx(2);
      const apiResult = await performOCR(image.file);
      onOcrResult(apiResult);

      // Instantly parse live OCR text so the real product fields are shown immediately
      if (apiResult.text && apiResult.text.trim() && onClientExtracted) {
        const parsed = parseOcrTextClientSide(apiResult.text, image.file.name);
        onClientExtracted(parsed.fields, parsed.checks);
      }

      // Stage 3: Legal Metrology Structuring & Compliance Analysis (Flask Backend)
      setStageIdx(3);
      if (apiResult.text && apiResult.text.trim()) {
        try {
          const fRes = await analyzeText(apiResult.text, image.file.name);
          onFlaskResult(fRes);
        } catch (fErr: any) {
          console.warn("Flask compliance engine unavailable, keeping live OCR extracted fields:", fErr);
        }
      }

      setDone(true);
      setRunning(false);
    } catch (err: any) {
      console.error("Analysis error:", err);
      setError(err.message || "Failed to complete OCR analysis. Please check your backend connection.");
      setRunning(false);
      setStageIdx(-1);
    }
  };

  const progress = done ? 100 : stageIdx < 0 ? 0 : Math.round(((stageIdx + 1) / STAGES.length) * 100);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">AI/OCR Analysis</h2>
        <p className="text-sm text-muted-foreground mt-1">
          The system will process the uploaded image via OpenCV and extract package text using PaddleOCR.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 space-y-5">
        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-foreground">
              {done ? "Analysis complete" : running ? "Processing on FastAPI backend..." : "Ready to process"}
            </span>
            <span className="font-semibold text-primary">{progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Stages list */}
        <div className="space-y-2">
          {STAGES.map((stage, i) => {
            const isActive = stageIdx === i && !done;
            const isDone = done || stageIdx > i;
            return (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all",
                  isDone ? "bg-emerald-50" : isActive ? "bg-primary/5 border border-primary/20" : "bg-muted/50"
                )}
              >
                <div
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full flex-shrink-0",
                    isDone ? "bg-emerald-500" : isActive ? "bg-primary" : "bg-muted-foreground/30"
                  )}
                >
                  {isDone ? (
                    <Check className="h-3 w-3 text-white" />
                  ) : isActive ? (
                    <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
                  ) : (
                    <div className="h-2 w-2 rounded-full bg-muted-foreground/50" />
                  )}
                </div>
                <span
                  className={cn(
                    "text-xs",
                    isDone ? "text-emerald-700 font-medium" : isActive ? "text-primary font-medium" : "text-muted-foreground"
                  )}
                >
                  {stage.label}
                </span>
                {isActive && (
                  <span className="ml-auto text-[10px] text-primary animate-pulse">Processing</span>
                )}
                {isDone && (
                  <span className="ml-auto text-[10px] text-emerald-600">Done</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 flex gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs font-semibold text-red-800">OCR Analysis Failed</p>
            <p className="text-xs text-red-700">{error}</p>
          </div>
        </div>
      )}

      {!running && !done && !error && (
        <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 flex gap-3">
          <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700">
            Click <strong>Start Analysis</strong> to send your image to the live FastAPI backend (<code>{API_BASE_URL}</code>) for OpenCV preprocessing and PaddleOCR text extraction.
          </p>
        </div>
      )}

      {done && (
        <div className="space-y-3">
          {ocrResult && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-4 py-3 flex gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-emerald-800">PaddleOCR Analysis Complete</p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Detected <strong>{ocrResult.total_lines_detected} text line(s)</strong> from FastAPI backend.
                </p>
              </div>
            </div>
          )}
          {flaskResult ? (
            <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 flex gap-3">
              <ShieldCheck className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-blue-800">Legal Metrology Compliance Checked</p>
                <p className="text-xs text-blue-700 mt-0.5">
                  Saved as Inspection <strong>#{flaskResult.id}</strong> · Initial Status: <strong>{flaskResult.status}</strong> · Score: <strong>{flaskResult.score}%</strong>
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-amber-50 border border-amber-100 px-4 py-3 flex gap-3">
              <Info className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                Flask backend at {FLASK_API_URL} was not reached. Using client-side rules fallback.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          disabled={running}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        {!done ? (
          <button
            onClick={startAnalysis}
            disabled={running}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {running ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" /> Analysing with PaddleOCR...
              </>
            ) : (
              <>
                <Cpu className="h-4 w-4" /> {error ? "Retry Analysis" : "Start Analysis"}
              </>
            )}
          </button>
        ) : (
          <button
            onClick={onNext}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
          >
            View OCR Text &amp; Details <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────
// Step 4 — Extracted Information
// ──────────────────────────────────────────────────────
function Step4Extracted({
  ocrResult,
  fields,
  onFields,
  onBack,
  onNext,
}: {
  ocrResult: OcrApiResponse | null;
  fields: ExtractedField[];
  onFields: (f: ExtractedField[]) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  const startEdit = (idx: number) => {
    setEditingIdx(idx);
    setEditValue(fields[idx].value ?? "");
  };

  const saveEdit = (idx: number) => {
    const updated = fields.map((f, i) =>
      i === idx ? { ...f, value: editValue || null, status: "detected" as const, edited: true } : f
    );
    onFields(updated);
    setEditingIdx(null);
  };

  const sections = [
    {
      title: "Product Information",
      fieldLabels: ["Product Name", "Brand", "Category"],
    },
    {
      title: "Manufacturer / Importer",
      fieldLabels: ["Manufacturer / Packer", "Address", "Country of Origin"],
    },
    {
      title: "Package Declarations",
      fieldLabels: [
        "Net Quantity", "MRP", "Manufacturing Date", "Best Before",
        "Consumer Care", "Unit Sale Price", "FSSAI License", "Batch / Lot Number",
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">Extracted Information &amp; OCR Results</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Review the raw text detected by PaddleOCR along with the extracted package information.
        </p>
      </div>

      {/* Raw OCR Result Card */}
      {ocrResult && (
        <div className="rounded-xl border border-primary/20 bg-card p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Raw OCR Text (PaddleOCR)</h3>
            </div>
            <span className="text-xs font-mono bg-primary/10 text-primary px-2.5 py-1 rounded font-semibold">
              {ocrResult.total_lines_detected} line(s) detected
            </span>
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Detected Raw Text
            </p>
            {ocrResult.text ? (
              <div className="rounded-lg bg-muted/40 border border-border p-3.5 font-mono text-xs text-foreground whitespace-pre-wrap leading-relaxed select-all">
                {ocrResult.text}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic bg-muted/30 p-3 rounded">
                No text detected by PaddleOCR on this image.
              </p>
            )}
          </div>

          {ocrResult.ocr_details && ocrResult.ocr_details.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Line Breakdown &amp; Confidence Scores
              </p>
              <div className="grid gap-1.5 max-h-44 overflow-y-auto pr-1">
                {ocrResult.ocr_details.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-lg bg-card px-3 py-2 border border-border text-xs"
                  >
                    <span className="font-mono text-foreground truncate pr-3">{item.text}</span>
                    <span className="font-mono text-[11px] text-emerald-600 font-bold flex-shrink-0 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                      {(item.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-4 text-xs">
        {[
          { status: "detected", label: "Detected", color: "bg-emerald-500" },
          { status: "needs_review", label: "Needs Review", color: "bg-amber-500" },
          { status: "missing", label: "Missing", color: "bg-red-500" },
        ].map((s) => (
          <div key={s.status} className="flex items-center gap-1.5">
            <div className={cn("h-2 w-2 rounded-full", s.color)} />
            <span className="text-muted-foreground">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {sections.map((section) => {
          const sectionFields = fields.filter((f) =>
            section.fieldLabels.includes(f.label)
          );
          return (
            <div key={section.title} className="rounded-xl border border-border overflow-hidden">
              <div className="bg-muted/50 px-4 py-3 border-b border-border">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {section.title}
                </h3>
              </div>
              <div className="divide-y divide-border">
                {sectionFields.map((field, i) => {
                  const globalIdx = fields.findIndex((f) => f.label === field.label);
                  const isEditing = editingIdx === globalIdx;
                  return (
                    <div
                      key={field.label}
                      className={cn(
                        "flex items-start gap-3 px-4 py-3",
                        field.edited && "bg-blue-50/50",
                        field.status === "missing" && "bg-red-50/30",
                        field.status === "needs_review" && "bg-amber-50/30"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-[11px] font-medium text-muted-foreground">{field.label}</p>
                          {field.edited && (
                            <span className="text-[9px] font-semibold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                              EDITED
                            </span>
                          )}
                        </div>
                        {isEditing ? (
                          <input
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-full text-sm border border-primary rounded-md px-2 py-1 outline-none ring-1 ring-primary"
                            autoFocus
                          />
                        ) : (
                          <p
                            className={cn(
                              "text-sm font-medium",
                              field.value ? "text-foreground" : "text-red-500 italic"
                            )}
                          >
                            {field.value ?? "Not detected"}
                          </p>
                        )}
                        {field.confidence !== undefined && field.confidence > 0 && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Confidence: {field.confidence}%
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 pt-1">
                        <StatusBadge type="field" value={field.status} />
                        {isEditing ? (
                          <button
                            onClick={() => saveEdit(globalIdx)}
                            className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-white hover:bg-primary/90"
                          >
                            <Save className="h-3 w-3" />
                          </button>
                        ) : (
                          <button
                            onClick={() => startEdit(globalIdx)}
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        <button
          onClick={onNext}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
        >
          Check Compliance <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────
// Step 5 — Compliance
// ──────────────────────────────────────────────────────
function Step5Compliance({
  checks,
  onBack,
  onNext,
}: {
  checks: ComplianceCheck[];
  onBack: () => void;
  onNext: () => void;
}) {
  const passed = checks.filter((c) => c.status === "pass").length;
  const failed = checks.filter((c) => c.status === "fail").length;
  const review = checks.filter((c) => c.status === "needs_review").length;
  const overallResult =
    failed > 0 ? "potential_violation" : review > 0 ? "needs_review" : "compliant";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">Compliance Results</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Results of the automated compliance check against Legal Metrology (Packaged Commodities) Rules 2011. Inspector verification is required before finalizing.
        </p>
      </div>

      {/* Overall status */}
      <div
        className={cn(
          "rounded-xl border-2 p-6 text-center",
          overallResult === "compliant"
            ? "border-emerald-200 bg-emerald-50"
            : overallResult === "potential_violation"
            ? "border-red-200 bg-red-50"
            : "border-amber-200 bg-amber-50"
        )}
      >
        <div className="flex justify-center mb-3">
          {overallResult === "compliant" ? (
            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
          ) : overallResult === "potential_violation" ? (
            <AlertTriangle className="h-12 w-12 text-red-500" />
          ) : (
            <Clock className="h-12 w-12 text-amber-500" />
          )}
        </div>
        <h3
          className={cn(
            "text-xl font-bold",
            overallResult === "compliant"
              ? "text-emerald-700"
              : overallResult === "potential_violation"
              ? "text-red-700"
              : "text-amber-700"
          )}
        >
          {overallResult === "compliant"
            ? "Compliant"
            : overallResult === "potential_violation"
            ? "Potential Violation Detected"
            : "Needs Review"}
        </h3>
        <p
          className={cn(
            "text-sm mt-1",
            overallResult === "compliant"
              ? "text-emerald-600"
              : overallResult === "potential_violation"
              ? "text-red-600"
              : "text-amber-600"
          )}
        >
          {overallResult === "compliant"
            ? "All mandatory declarations appear to be present and in order."
            : overallResult === "potential_violation"
            ? "One or more potential violations detected. Inspector verification required."
            : "Some declarations require closer inspection. Inspector review recommended."}
        </p>
        <div className="flex items-center justify-center gap-6 mt-4 text-sm">
          <div className="text-center">
            <p className="text-2xl font-bold text-emerald-600">{passed}</p>
            <p className="text-xs text-muted-foreground">Passed</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-600">{failed}</p>
            <p className="text-xs text-muted-foreground">Violations</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-amber-600">{review}</p>
            <p className="text-xs text-muted-foreground">Review</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">{checks.length}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
        </div>
      </div>

      {/* Checks table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-muted/50 px-4 py-3 border-b border-border">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Compliance Checks</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase">Requirement</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase">Value</th>
                <th className="hidden md:table-cell px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase">Rule</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {checks.map((check) => (
                <tr
                  key={check.id}
                  className={cn(
                    "hover:bg-muted/30",
                    check.status === "fail" && "bg-red-50/50",
                    check.status === "needs_review" && "bg-amber-50/50"
                  )}
                >
                  <td className="px-4 py-3 font-medium text-foreground text-xs">{check.requirement}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{check.value ?? "—"}</td>
                  <td className="hidden md:table-cell px-4 py-3 text-[11px] font-mono text-muted-foreground">{check.rule}</td>
                  <td className="px-4 py-3">
                    <StatusBadge type="compliance" value={check.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Violation detail for needs_review */}
      {review > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-600" />
            <h3 className="text-sm font-semibold text-amber-800">Items Requiring Review</h3>
          </div>
          {checks
            .filter((c) => c.status === "needs_review")
            .map((c) => (
              <div key={c.id} className="text-xs text-amber-700">
                <strong>{c.requirement}:</strong> {c.detail ?? "Inspector review recommended"}
              </div>
            ))}
        </div>
      )}

      <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 flex gap-3">
        <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700">
          These results are generated by the automated compliance rule engine and are <strong>not a final legal determination</strong>. The inspector must verify all findings before finalizing the inspection record.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        <button
          onClick={onNext}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
        >
          Inspector Verification <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────
// Step 6 — Inspector Verification
// ──────────────────────────────────────────────────────
function Step6Verification({
  checks,
  inspectionDbId,
  onBack,
  onNext,
}: {
  checks: ComplianceCheck[];
  inspectionDbId?: number | null;
  onBack: () => void;
  onNext: (decision: string, remarks: string) => void;
}) {
  const [decision, setDecision] = useState<"compliant" | "confirmed_violation" | "further_review" | null>(null);
  const [remarks, setRemarks] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const passed = checks.filter((c) => c.status === "pass").length;
  const failed = checks.filter((c) => c.status === "fail").length;

  const handleFinalize = () => {
    setConfirming(true);
  };

  const handleConfirm = async () => {
    setConfirmed(true);
    if (inspectionDbId) {
      try {
        await submitVerification(inspectionDbId, decision!, remarks);
      } catch (err) {
        console.error("Failed to submit verification to backend:", err);
      }
    }
    await new Promise((r) => setTimeout(r, 800));
    onNext(decision!, remarks);
  };

  if (confirmed) {
    return (
      <div className="flex flex-col items-center py-12 space-y-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
          <Check className="h-8 w-8 text-emerald-600" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">Verification Saved</h2>
        <p className="text-sm text-muted-foreground text-center max-w-sm">
          Inspector verification recorded. Proceeding to report generation...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">Inspector Verification</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Review the system findings and make your professional determination. Your decision is final and will be recorded in the inspection report.
        </p>
      </div>

      {/* Summary */}
      <div className="grid sm:grid-cols-3 gap-4">
        {[
          { label: "Passed Checks", value: passed, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Potential Violations", value: failed, color: "text-red-600", bg: "bg-red-50" },
          { label: "Total Checks", value: checks.length, color: "text-foreground", bg: "bg-muted" },
        ].map((s) => (
          <div key={s.label} className={cn("rounded-xl p-4 text-center", s.bg)}>
            <p className={cn("text-2xl font-bold", s.color)}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Decision buttons */}
      <div>
        <p className="text-sm font-semibold text-foreground mb-3">Inspector Decision</p>
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            {
              value: "compliant" as const,
              label: "Mark as Compliant",
              desc: "Package meets all requirements",
              icon: CheckCircle2,
              active: "bg-emerald-600 text-white border-emerald-600",
              inactive: "border-border text-foreground hover:border-emerald-300 hover:bg-emerald-50",
            },
            {
              value: "confirmed_violation" as const,
              label: "Confirm Potential Violation",
              desc: "Package has regulatory violations",
              icon: AlertTriangle,
              active: "bg-red-600 text-white border-red-600",
              inactive: "border-border text-foreground hover:border-red-300 hover:bg-red-50",
            },
            {
              value: "further_review" as const,
              label: "Needs Further Review",
              desc: "Additional investigation required",
              icon: Clock,
              active: "bg-amber-500 text-white border-amber-500",
              inactive: "border-border text-foreground hover:border-amber-300 hover:bg-amber-50",
            },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDecision(opt.value)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-sm font-medium transition-all",
                decision === opt.value ? opt.active : opt.inactive
              )}
            >
              <opt.icon className="h-5 w-5" />
              <span className="font-semibold">{opt.label}</span>
              <span className={cn("text-[11px]", decision === opt.value ? "opacity-80" : "text-muted-foreground")}>
                {opt.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Remarks */}
      <div>
        <label className="block text-sm font-semibold text-foreground mb-2">
          Inspector Remarks
        </label>
        <textarea
          rows={4}
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Enter inspection remarks, observations, or notes for the record..."
          className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Confirmation dialog */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-card border border-border p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-semibold text-foreground">Confirm Verification</h3>
            <p className="text-sm text-muted-foreground">
              You are about to finalize this inspection with the following decision:
            </p>
            <div className="rounded-lg bg-muted p-3">
              <StatusBadge
                type="verification"
                value={decision === "compliant" ? "verified" : decision === "confirmed_violation" ? "confirmed_violation" : "further_review"}
              />
              {remarks && <p className="text-xs text-muted-foreground mt-2">{remarks}</p>}
            </div>
            <p className="text-xs text-muted-foreground">
              This action cannot be undone. The decision will be permanently recorded in the inspection report.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirming(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
              >
                Confirm & Finalize
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        <button
          onClick={handleFinalize}
          disabled={!decision}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
        >
          Finalize Inspection <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────
// Step 7 — Report
// ──────────────────────────────────────────────────────
function Step7Report({
  fields,
  checks,
  decision,
  remarks,
  inspectionId,
}: {
  fields: ExtractedField[];
  checks: ComplianceCheck[];
  decision: string;
  remarks: string;
  inspectionId: string;
}) {
  const router = useRouter();
  const passed = checks.filter((c) => c.status === "pass").length;
  const failed = checks.filter((c) => c.status === "fail").length;
  const review = checks.filter((c) => c.status === "needs_review").length;
  const now = new Date().toLocaleString("en-IN");

  const getValue = (label: string) =>
    fields.find((f) => f.label === label)?.value ?? "—";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Inspection Report</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Final inspection report. Review and download.
          </p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">
          <Download className="h-4 w-4" />
          Download PDF
        </button>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        {/* Report header */}
        <div className="bg-primary px-6 py-5 text-white">
          <div className="flex items-center gap-3 mb-3">
            <Scale className="h-6 w-6" />
            <div>
              <h3 className="font-bold text-lg">Statera Inspection Report</h3>
              <p className="text-primary-foreground/70 text-xs">Legal Metrology Digital Inspection System</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs mt-4">
            <div>
              <p className="text-primary-foreground/70">Inspection ID</p>
              <p className="font-semibold">{inspectionId}</p>
            </div>
            <div>
              <p className="text-primary-foreground/70">Date & Time</p>
              <p className="font-semibold">{now}</p>
            </div>
            <div>
              <p className="text-primary-foreground/70">Inspector</p>
              <p className="font-semibold">Rajesh Kumar</p>
            </div>
            <div>
              <p className="text-primary-foreground/70">Inspector ID</p>
              <p className="font-semibold">INS-DL-042</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Product Information */}
          <section>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Product Information</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
              {[
                { label: "Product Name", val: getValue("Product Name") },
                { label: "Brand", val: getValue("Brand") },
                { label: "Category", val: getValue("Category") },
                { label: "Net Quantity", val: getValue("Net Quantity") },
                { label: "MRP", val: getValue("MRP") },
                { label: "Country of Origin", val: getValue("Country of Origin") },
              ].map((r) => (
                <div key={r.label}>
                  <p className="text-[11px] text-muted-foreground">{r.label}</p>
                  <p className="text-sm font-medium text-foreground">{r.val}</p>
                </div>
              ))}
            </div>
          </section>
          <hr className="border-border" />

          {/* Manufacturer */}
          <section>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Manufacturer / Packer / Importer</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
              {[
                { label: "Name", val: getValue("Manufacturer / Packer") },
                { label: "Address", val: getValue("Address") },
              ].map((r) => (
                <div key={r.label}>
                  <p className="text-[11px] text-muted-foreground">{r.label}</p>
                  <p className="text-sm font-medium text-foreground">{r.val}</p>
                </div>
              ))}
            </div>
          </section>
          <hr className="border-border" />

          {/* Compliance Summary */}
          <section>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Compliance Summary</h4>
            <div className="grid grid-cols-4 gap-4 mb-4">
              {[
                { label: "Overall Result", val: decision === "compliant" ? "Compliant" : decision === "confirmed_violation" ? "Violation Confirmed" : "Further Review", color: decision === "compliant" ? "text-emerald-600" : decision === "confirmed_violation" ? "text-red-600" : "text-amber-600" },
                { label: "Passed", val: passed.toString(), color: "text-emerald-600" },
                { label: "Violations", val: failed.toString(), color: "text-red-600" },
                { label: "Review", val: review.toString(), color: "text-amber-600" },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <p className={cn("text-xl font-bold", s.color)}>{s.val}</p>
                  <p className="text-[11px] text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          </section>
          <hr className="border-border" />

          {/* Inspector Verification */}
          <section>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Inspector Verification</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-[11px] text-muted-foreground">Final Decision</p>
                <p className="text-sm font-semibold text-foreground capitalize">{decision?.replace("_", " ")}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-[11px] text-muted-foreground">Remarks</p>
                <p className="text-sm text-foreground">{remarks || "No remarks provided."}</p>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="bg-muted/50 border-t border-border px-6 py-4 text-[11px] text-muted-foreground">
          <p className="font-medium">⚠ Important Disclaimer</p>
          <p className="mt-0.5">This report is generated by the Statera digital inspection system. The AI/OCR extracted information is for inspection assistance only and is subject to the inspector&apos;s professional verification. This report does not constitute a final legal order or determination.</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push("/history")}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
        >
          View History
        </button>
        <button
          onClick={() => router.push("/dashboard")}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────
// Scale icon (reused from Sidebar — inline here)
// ──────────────────────────────────────────────────────
function Scale({ className }: { className?: string }) {
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

// ──────────────────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────────────────
export default function NewInspectionPage() {
  const [step, setStep] = useState(1);
  const [image, setImageState] = useState<{ file: File; url: string } | null>(null);
  const [ocrResult, setOcrResult] = useState<OcrApiResponse | null>(null);
  const [flaskResult, setFlaskResult] = useState<FlaskAnalyzeResponse | null>(null);
  const [fields, setFields] = useState<ExtractedField[]>([]);
  const [checks, setChecks] = useState<ComplianceCheck[]>([]);
  const [decision, setDecision] = useState<string>("");
  const [remarks, setRemarks] = useState<string>("");
  const [inspectionDbId, setInspectionDbId] = useState<number | null>(null);
  const [inspectionId, setInspectionId] = useState(
    `INS-2024-${String(Math.floor(Math.random() * 900) + 100).padStart(4, "0")}`
  );

  const setImage = (img: { file: File; url: string } | null) => {
    setImageState(img);
    setOcrResult(null); // Reset OCR result on new image
    setFlaskResult(null);
    setFields([]);
    setChecks([]);
  };

  const handleFlaskResult = (res: FlaskAnalyzeResponse) => {
    setFlaskResult(res);
    setInspectionDbId(res.id);
    setInspectionId(`INS-${res.id}`);
    const adaptedFields = flaskExtractedToFields(res.extracted_data);
    if (adaptedFields.length > 0) {
      setFields(adaptedFields);
    }
    const adaptedChecks = flaskReportToChecks(res.compliance_report);
    if (adaptedChecks.length > 0) {
      setChecks(adaptedChecks);
    }
  };

  const handleVerification = (d: string, r: string) => {
    setDecision(d);
    setRemarks(r);
    setStep(7);
  };

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground">New Inspection</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Complete the 7-step inspection workflow to analyse a packaged commodity.
        </p>
      </div>

      <StepIndicator currentStep={step} />

      <div className="bg-card rounded-xl border border-border p-4 lg:p-6">
        {step === 1 && (
          <Step1Upload image={image} onImage={setImage} onNext={() => setStep(2)} />
        )}
        {step === 2 && (
          <Step2Review image={image} onBack={() => setStep(1)} onNext={() => setStep(3)} />
        )}
        {step === 3 && (
          <Step3Analysis
            image={image}
            ocrResult={ocrResult}
            flaskResult={flaskResult}
            onOcrResult={setOcrResult}
            onFlaskResult={handleFlaskResult}
            onClientExtracted={(f, c) => {
              setFields(f);
              setChecks(c);
            }}
            onBack={() => setStep(2)}
            onNext={() => setStep(4)}
          />
        )}
        {step === 4 && (
          <Step4Extracted
            ocrResult={ocrResult}
            fields={fields}
            onFields={setFields}
            onBack={() => setStep(3)}
            onNext={() => setStep(5)}
          />
        )}
        {step === 5 && (
          <Step5Compliance
            checks={checks}
            onBack={() => setStep(4)}
            onNext={() => setStep(6)}
          />
        )}
        {step === 6 && (
          <Step6Verification
            checks={checks}
            inspectionDbId={inspectionDbId}
            onBack={() => setStep(5)}
            onNext={handleVerification}
          />
        )}
        {step === 7 && (
          <Step7Report
            fields={fields}
            checks={checks}
            decision={decision}
            remarks={remarks}
            inspectionId={inspectionId}
          />
        )}
      </div>
    </div>
  );
}
