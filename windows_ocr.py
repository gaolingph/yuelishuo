"""
OCR PDF page images using Windows.Media.Ocr API via winrt.
Handles large images by resizing them to fit within the OCR engine's limits.
Uses .wait(timeout_ms) for async operations.
"""
import os
import sys
from PIL import Image, ImageDraw, ImageFont
import io

from winrt.windows.media.ocr import OcrEngine
from winrt.windows.graphics.imaging import (
    BitmapDecoder, BitmapPixelFormat, SoftwareBitmap
)
from winrt.windows.storage.streams import (
    InMemoryRandomAccessStream
)
from winrt.windows.globalization import Language

TIMEOUT = 60000  # 60 seconds timeout for async operations
MAX_DIMENSION = 4000  # Maximum pixel dimension for OCR (Windows limit is ~8192 but safer at 4000)

def resize_for_ocr(image_path, max_dim=MAX_DIMENSION):
    """Resize image if it exceeds max dimension, returns image bytes."""
    img = Image.open(image_path)
    w, h = img.size
    
    if w <= max_dim and h <= max_dim:
        # No resize needed, return original bytes
        with open(image_path, 'rb') as f:
            return f.read(), (w, h)
    
    # Calculate new size maintaining aspect ratio
    if w > h:
        new_w = max_dim
        new_h = int(h * max_dim / w)
    else:
        new_h = max_dim
        new_w = int(w * max_dim / h)
    
    print(f"  Resizing: {w}x{h} -> {new_w}x{new_h}")
    img_resized = img.resize((new_w, new_h), Image.LANCZOS)
    
    buf = io.BytesIO()
    img_resized.save(buf, format='PNG')
    return buf.getvalue(), (new_w, new_h)

def ocr_image(image_path):
    """OCR a single image using Windows OCR API. Returns (text, lines)."""
    print(f"\n{'='*60}")
    print(f"  Processing: {os.path.basename(image_path)}")
    print(f"{'='*60}")
    
    # Resize if needed and get image bytes
    img_data, (img_width, img_height) = resize_for_ocr(image_path)
    print(f"  Size: {img_width}x{img_height}, {len(img_data)} bytes")
    
    # Create in-memory stream
    stream = InMemoryRandomAccessStream()
    write_op = stream.write_async(img_data)
    write_op.wait(TIMEOUT)
    stream.seek(0)
    
    # Decode image → SoftwareBitmap
    create_op = BitmapDecoder.create_async(stream)
    create_op.wait(TIMEOUT)
    decoder = create_op.get_results()
    
    get_bmp_op = decoder.get_software_bitmap_async()
    get_bmp_op.wait(TIMEOUT)
    software_bitmap = get_bmp_op.get_results()
    
    fmt = software_bitmap.bitmap_pixel_format
    print(f"  Bitmap: {software_bitmap.pixel_width}x{software_bitmap.pixel_height}, format: {fmt}")
    
    # Convert to BGRA8 if needed (Windows OCR requires this)
    if fmt != BitmapPixelFormat.BGRA8:
        software_bitmap = SoftwareBitmap.convert(software_bitmap, BitmapPixelFormat.BGRA8)
        print(f"  Converted to BGRA8")
    
    # Create OCR engine (try Chinese first)
    chinese = Language("zh-Hans-CN")
    
    if OcrEngine.is_language_supported(chinese):
        print(f"  ✓ Chinese (zh-Hans-CN) supported")
        engine = OcrEngine.try_create_from_language(chinese)
    else:
        print(f"  ⚠ Chinese not recognized, trying user profile")
        engine = OcrEngine.try_create_from_user_profile_languages()
    
    if engine is None:
        print(f"  ✗ Failed to create OCR engine!")
        return "", []
    
    engine_lang = engine.recognizer_language
    print(f"  Engine: {engine_lang.language_tag} ({engine_lang.display_name})")
    
    # Perform OCR
    print(f"  Recognizing text...")
    ocr_op = engine.recognize_async(software_bitmap)
    ocr_op.wait(TIMEOUT)
    result = ocr_op.get_results()
    
    text = result.text
    lines = list(result.lines) if result.lines else []
    
    print(f"  ✓ Extracted {len(text)} characters, {len(lines)} lines")
    
    if text:
        print(f"\n  --- TEXT ---")
        for i, line in enumerate(lines):
            print(f"  {line.text}")
        print(f"  --- END ---")
    else:
        print(f"  (no text detected)")
    
    return text, lines

def create_test_image():
    """Create a test image with Chinese text."""
    print("=== Creating test image ===")
    img = Image.new('RGB', (1200, 300), color='white')
    draw = ImageDraw.Draw(img)
    
    font_paths = [
        r"C:\Windows\Fonts\msyh.ttc",
        r"C:\Windows\Fonts\simsun.ttc",
        r"C:\Windows\Fonts\msyhbd.ttc",
    ]
    font = None
    for fp in font_paths:
        if os.path.exists(fp):
            try:
                font = ImageFont.truetype(fp, 42)
                break
            except:
                pass
    if font is None:
        font = ImageFont.load_default()
    
    draw.text((30, 30), "从趋势到增长 — 方二教授", fill='black', font=font)
    draw.text((30, 120), "数字董事会：AI时代的战略决策新模式", fill='black', font=font)
    draw.text((30, 210), "2024年趋势分析与增长策略", fill='black', font=font)
    
    test_path = r"C:\Users\Lenovo\ZCodeProject\test_chinese.png"
    img.save(test_path)
    print(f"  Created: {test_path}")
    return test_path

def main():
    # Step 1: Verify OCR works with test image
    print("=" * 60)
    print("  STEP 1: Testing OCR with known Chinese text")
    print("=" * 60)
    
    test_path = create_test_image()
    test_text, test_lines = ocr_image(test_path)
    
    if test_text and len(test_text.strip()) > 5:
        print(f"\n  ✓ OCR IS WORKING!")
    else:
        print(f"\n  ✗ OCR test failed!")
        langs = OcrEngine.available_recognizer_languages
        print("  Available OCR languages:")
        for lang in langs:
            print(f"    - {lang.language_tag} ({lang.display_name})")
        return
    
    # Step 2: Process PDF page images
    print("\n\n")
    print("=" * 60)
    print("  STEP 2: Processing PDF page images")
    print("=" * 60)
    
    image_dir = r"C:\Users\Lenovo\ZCodeProject\pdf_images"
    if not os.path.exists(image_dir):
        print(f"  ✗ Directory not found: {image_dir}")
        return
    
    images = sorted([f for f in os.listdir(image_dir) if f.endswith('.png')])
    print(f"  Found {len(images)} PDF page images")
    
    all_pages_text = []
    
    for img_name in images:
        img_path = os.path.join(image_dir, img_name)
        try:
            page_text, page_lines = ocr_image(img_path)
        except Exception as e:
            print(f"  ✗ Error on {img_name}: {e}")
            page_text = f"[OCR Error: {e}]"
        
        header = f"\n{'='*60}\nPAGE: {img_name}\n{'='*60}"
        all_pages_text.append(header + "\n" + page_text)
    
    # Save full result
    output_path = r"C:\Users\Lenovo\ZCodeProject\pdf_ocr_result.txt"
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(all_pages_text))
    
    print(f"\n\n{'='*60}")
    print(f"  ✓ OCR COMPLETE")
    print(f"  ✓ Saved to: {output_path}")
    
    total_chars = sum(len(t) for t in all_pages_text)
    print(f"  ✓ Total text length: {total_chars} characters")
    print(f"{'='*60}")
    
    # Show full text
    if total_chars > 0:
        full_text = '\n'.join(all_pages_text)
        print("\n\n" + "="*60)
        print("FULL OCR RESULT")
        print("="*60)
        print(full_text)

if __name__ == "__main__":
    main()
