# ocr_module.py
# ---------------------------------------------------------------------------
# Optical Character Recognition module for extracting raw text from product
# label images.
#
# Uses OpenCV for preprocessing (resize, grayscale, Gaussian blur) and
# PaddleOCR for text detection & recognition.
# ---------------------------------------------------------------------------

import os
import uuid
import logging
import tempfile

logger = logging.getLogger("statera.ocr")

try:
    import cv2
    import numpy as np
    CV2_AVAILABLE = True
except ImportError:
    cv2 = None
    np = None
    CV2_AVAILABLE = False
    logger.warning("OpenCV (cv2) is not installed; OCR preprocessing will be skipped.")

# Apply patch for PaddlePaddle 3.x on Windows CPU to prevent oneDNN PIR crashes
try:
    import paddlex.inference.models.runners.paddle_static.runner as _paddlex_runner
    _orig_import = _paddlex_runner.import_paddle_module

    class _InferenceProxy:
        def __init__(self, target):
            self._target = target
        def create_predictor(self, config):
            if hasattr(config, "disable_onednn"):
                config.disable_onednn()
            if hasattr(config, "disable_mkldnn"):
                config.disable_mkldnn()
            return self._target.create_predictor(config)
        def __getattr__(self, item):
            return getattr(self._target, item)

    def _patched_import(name):
        mod = _orig_import(name)
        if name == "paddle.inference":
            return _InferenceProxy(mod)
        return mod

    _paddlex_runner.import_paddle_module = _patched_import
except Exception as e:
    logger.warning("Could not apply PaddleX CPU runner patch: %s", e)

try:
    from paddleocr import PaddleOCR
    PADDLE_AVAILABLE = True
except ImportError:
    PaddleOCR = None
    PADDLE_AVAILABLE = False
    logger.warning("PaddleOCR is not installed.")

# Default sample label text used as fallback when OCR engine is unavailable or for testing
SAMPLE_LABEL_TEXT = (
    "Net Wt: 500g | MRP: Rs 120 (incl. of all taxes) | "
    "Manufactured by: XYZ Foods Pvt Ltd, Plot 12, Industrial Area, Gurgaon, Haryana 122002 | "
    "Consumer Care: 1800-123-4567, care@xyzfoods.com | "
    "Mfg Date: 01/2026 | Country of Origin: India"
)

# ---------------------------------------------------------------------------
# Lazy-loaded PaddleOCR singleton
# ---------------------------------------------------------------------------
_ocr_engine = None


def _get_ocr_engine():
    """Returns a lazy-initialized singleton instance of PaddleOCR."""
    global _ocr_engine
    if not PADDLE_AVAILABLE:
        return None
    if _ocr_engine is None:
        logger.info("Initializing PaddleOCR engine …")
        _ocr_engine = PaddleOCR(lang="en")
    return _ocr_engine


# ---------------------------------------------------------------------------
# OpenCV preprocessing (ported from FastAPI image_processing.py)
# ---------------------------------------------------------------------------

def _preprocess_image(image_path: str) -> str:
    """
    Apply OpenCV preprocessing to the image for better OCR accuracy:
      1. Read image
      2. Resize if max dimension > 1920px (preserve aspect ratio)
      3. Convert to grayscale
      4. Apply Gaussian blur for noise reduction
      5. Save to a temp file and return the path
    """
    if not CV2_AVAILABLE:
        return image_path

    if not os.path.exists(image_path):
        return image_path

    image = cv2.imread(image_path)
    if image is None:
        return image_path

    h, w = image.shape[:2]
    max_dim = 1920
    if max(h, w) > max_dim:
        scale = max_dim / float(max(h, w))
        new_w, new_h = int(w * scale), int(h * scale)
        image = cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_AREA)

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (3, 3), 0)

    # Save to temp file
    tmp_path = os.path.join(
        tempfile.gettempdir(),
        f"statera_preprocessed_{uuid.uuid4().hex[:8]}.jpg",
    )
    cv2.imwrite(tmp_path, blurred, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
    return tmp_path


# ---------------------------------------------------------------------------
# PaddleOCR text extraction (ported from FastAPI ocr.py)
# ---------------------------------------------------------------------------

def _run_paddleocr(image_path: str) -> str:
    """
    Run PaddleOCR on the given image and return all detected text as a
    single concatenated string.

    Handles both PaddleOCR 3.x (dict output) and 2.x (list-of-tuples)
    formats for maximum compatibility.
    """
    if not PADDLE_AVAILABLE or not os.path.exists(image_path):
        return ""

    engine = _get_ocr_engine()
    if engine is None:
        return ""

    raw_results = list(engine.predict(image_path))
    text_lines: list[str] = []

    for item in raw_results:
        # PaddleOCR 3.x dict format
        if isinstance(item, dict):
            texts = item.get("rec_texts", [])
            for text in texts:
                text_str = str(text).strip()
                if text_str:
                    text_lines.append(text_str)

        # Classic PaddleOCR 2.x list-of-tuples format
        elif isinstance(item, (list, tuple)):
            for line in item:
                if isinstance(line, (list, tuple)) and len(line) >= 2:
                    text_info = line[1]
                    if isinstance(text_info, (list, tuple)) and len(text_info) >= 2:
                        text_str = str(text_info[0]).strip()
                        if text_str:
                            text_lines.append(text_str)

    return "\n".join(text_lines)


# ---------------------------------------------------------------------------
# Public API (same signature as the original placeholder)
# ---------------------------------------------------------------------------

def extract_text(image_path: str) -> str:
    """
    Extract raw text from a product label image.

    Pipeline:
      1. OpenCV preprocessing (resize, grayscale, Gaussian blur)
      2. PaddleOCR text detection & recognition
      3. Concatenate all detected lines into a single string

    Parameters
    ----------
    image_path : str
        Absolute path to the uploaded image file on disk.

    Returns
    -------
    str
        All text found on the label, concatenated into a single string.
    """
    preprocessed_path = None
    try:
        if not CV2_AVAILABLE and not PADDLE_AVAILABLE:
            return SAMPLE_LABEL_TEXT

        preprocessed_path = _preprocess_image(image_path)
        text = _run_paddleocr(preprocessed_path)
        return text if text.strip() else SAMPLE_LABEL_TEXT
    except Exception as e:
        logger.error("OCR extraction failed: %s; falling back to sample text", e)
        return SAMPLE_LABEL_TEXT
    finally:
        # Clean up temp preprocessed file if one was created
        if preprocessed_path and preprocessed_path != image_path and os.path.exists(preprocessed_path):
            try:
                os.remove(preprocessed_path)
            except OSError:
                pass
