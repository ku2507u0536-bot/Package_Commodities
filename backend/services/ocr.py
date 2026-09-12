import logging
from typing import Dict, Any, List

# Configure logger
logger = logging.getLogger("statera.ocr")

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

# Lazy-loaded PaddleOCR instance
_ocr_engine = None


def get_ocr_engine():
    """
    Returns a lazy-initialized singleton instance of PaddleOCR.
    """
    global _ocr_engine
    if not PADDLE_AVAILABLE:
        return None
    if _ocr_engine is None:
        logger.info("Initializing PaddleOCR engine...")
        _ocr_engine = PaddleOCR(
    lang="en",
    use_angle_cls=False,
    det_db_thresh=0.3,
    det_db_box_thresh=0.6,
    show_log=False
)
    return _ocr_engine


def run_ocr(image_path: str) -> Dict[str, Any]:
    """
    Runs PaddleOCR on the specified image file path.
    Returns detected text, line list, confidence scores, and line count.
    """
    if not PADDLE_AVAILABLE:
        logger.error("PaddleOCR is not available.")
        return {
            "text": "",
            "lines": [],
            "details": [],
            "total_lines_detected": 0,
        }

    engine = get_ocr_engine()
    if engine is None:
        logger.error("Could not obtain PaddleOCR engine.")
        return {
            "text": "",
            "lines": [],
            "details": [],
            "total_lines_detected": 0,
        }

    raw_results = list(engine.predict(image_path))

    detected_items: List[Dict[str, Any]] = []
    full_text_lines: List[str] = []

    for item in raw_results:
        # PaddleOCR 3.x dict format
        if isinstance(item, dict):
            texts = item.get("rec_texts", [])
            scores = item.get("rec_scores", [])
            for text, score in zip(texts, scores):
                text_str = str(text).strip()
                score_val = float(score)
                if text_str:
                    full_text_lines.append(text_str)
                    detected_items.append({
                        "text": text_str,
                        "confidence": round(score_val, 4)
                    })

        # Classic PaddleOCR 2.x list of tuples format fallback
        elif isinstance(item, (list, tuple)):
            for line in item:
                if isinstance(line, (list, tuple)) and len(line) >= 2:
                    text_info = line[1]
                    if isinstance(text_info, (list, tuple)) and len(text_info) >= 2:
                        text_str = str(text_info[0]).strip()
                        score_val = float(text_info[1])
                        if text_str:
                            full_text_lines.append(text_str)
                            detected_items.append({
                                "text": text_str,
                                "confidence": round(score_val, 4)
                            })

    full_text = "\n".join(full_text_lines)

    return {
        "text": full_text,
        "lines": full_text_lines,
        "details": detected_items,
        "total_lines_detected": len(full_text_lines)
    }
