import logging
import cv2
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
            det_db_box_thresh=0.6
        )
    return _ocr_engine


def run_ocr(image_path: str) -> Dict[str, Any]:
    """Runs PaddleOCR on the specified image file path with auto-resizing."""
    engine = get_ocr_engine()
    if engine is None:
        return {"error": "PaddleOCR is not available"}

    # Load and downscale image to prevent Render CPU timeouts
    img = cv2.imread(image_path)
    if img is None:
        return {"error": "Could not read image file"}

    h, w = img.shape[:2]
    max_dim = 1000

    if max(h, w) > max_dim:
        scale = max_dim / float(max(h, w))
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

    # Pass downscaled image array to PaddleOCR
    results = engine.ocr(img, cls=False)
    return {"results": results}
