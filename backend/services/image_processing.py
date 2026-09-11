import os
import uuid
import cv2
import numpy as np
from typing import Dict, Any

# Define paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIC_DIR = os.path.join(BASE_DIR, "static")
UPLOADS_DIR = os.path.join(STATIC_DIR, "uploads")
RAW_DIR = os.path.join(UPLOADS_DIR, "raw")
PROCESSED_DIR = os.path.join(UPLOADS_DIR, "processed")

# Create directories
os.makedirs(RAW_DIR, exist_ok=True)
os.makedirs(PROCESSED_DIR, exist_ok=True)


def process_image(file_bytes: bytes, filename: str) -> Dict[str, Any]:
    """
    Receives uploaded image bytes and filename.
    1. Saves original image to static/uploads/raw/
    2. Decodes image with OpenCV
    3. Resizes if max dimension exceeds 1920px (preserving aspect ratio)
    4. Converts image to grayscale
    5. Applies Gaussian Blur for noise reduction
    6. Saves processed image to static/uploads/processed/
    7. Returns metadata including URLs for viewing
    """
    unique_id = uuid.uuid4().hex[:8]
    base_name, ext = os.path.splitext(filename)
    clean_ext = ext.lower() if ext.lower() in [".jpg", ".jpeg", ".png", ".webp"] else ".jpg"

    raw_filename = f"{unique_id}_raw{clean_ext}"
    processed_filename = f"{unique_id}_processed.jpg"

    raw_file_path = os.path.join(RAW_DIR, raw_filename)
    processed_file_path = os.path.join(PROCESSED_DIR, processed_filename)

    # 1. Save original file
    with open(raw_file_path, "wb") as f:
        f.write(file_bytes)

    # 2. Decode with OpenCV
    nparr = np.frombuffer(file_bytes, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if image is None:
        raise ValueError("Failed to decode image. Unsupported or corrupt image file.")

    orig_height, orig_width, channels = image.shape
    orig_size = len(file_bytes)

    # 3. Resize if necessary (max dimension 1920px)
    max_dim = 1920
    h, w = orig_height, orig_width
    if max(h, w) > max_dim:
        scale = max_dim / float(max(h, w))
        new_w = int(w * scale)
        new_h = int(h * scale)
        resized_img = cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_AREA)
    else:
        resized_img = image

    # 4. Convert to Grayscale
    gray_img = cv2.cvtColor(resized_img, cv2.COLOR_BGR2GRAY)

    # 5. Apply basic noise reduction (Gaussian Blur)
    blurred_img = cv2.GaussianBlur(gray_img, (3, 3), 0)

    # 6. Save processed image
    cv2.imwrite(processed_file_path, blurred_img, [int(cv2.IMWRITE_JPEG_QUALITY), 90])

    proc_height, proc_width = blurred_img.shape
    proc_size = os.path.getsize(processed_file_path)

    # Relative static URLs
    raw_url = f"/static/uploads/raw/{raw_filename}"
    processed_url = f"/static/uploads/processed/{processed_filename}"

    return {
        "success": True,
        "original_image": {
            "filename": filename,
            "saved_as": raw_filename,
            "width": orig_width,
            "height": orig_height,
            "channels": channels,
            "size_bytes": orig_size,
            "url": raw_url,
        },
        "processed_image": {
            "filename": processed_filename,
            "width": proc_width,
            "height": proc_height,
            "size_bytes": proc_size,
            "preprocessing": [
                "Resize (max 1920px)",
                "Grayscale Conversion (cv2.COLOR_BGR2GRAY)",
                "Gaussian Noise Reduction (cv2.GaussianBlur 3x3)",
            ],
            "url": processed_url,
            "path": processed_file_path,
        },
    }
