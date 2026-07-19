"""
Use Windows.Media.Ocr API via winrt to perform OCR on PDF page images.
Uses await for async operations.
"""
import asyncio
import sys
import os
from PIL import Image, ImageDraw, ImageFont

from winrt.windows.media.ocr import OcrEngine
from winrt.windows.graphics.imaging import (
    BitmapDecoder, BitmapPixelFormat, SoftwareBitmap
)
from winrt.windows.storage.streams import (
    FileRandomAccessStream, InMemoryRandomAccessStream,
    InputStreamOptions
)
from winrt.windows.foundation import IAsyncOperation, IAsyncOperationWithProgress

async def ocr_image_file(image_path):
    """OCR a single image file using Windows OCR API via winrt."""
    print(f"\n=== OCR: {os.path.basename(image_path)} ===")
    
    # Open file stream
    stream = FileRandomAccessStream.open_async(image_path)
    stream_completed = stream.get_results()
    # Alternative: just await
    # Actually in winrt, the approach is:
    # Task = await IAsyncOperation
    
    # Let me try a different approach - use the file directly
    stream = FileRandomAccessStream()
    await stream.open_async(image_path)
    
    # Decode image
    decoder = await BitmapDecoder.create_async(stream)
    software_bitmap = await decoder.get_software_bitmap()
    
    # Convert to BGRA8 if needed
    if software_bitmap.bitmap_pixel_format != BitmapPixelFormat.BGRA8:
        software_bitmap = SoftwareBitmap.convert(software_bitmap, BitmapPixelFormat.BGRA8)
    
    print(f"  Bitmap: {software_bitmap.pixel_width}x{software_bitmap.pixel_height}, {software_bitmap.bitmap_pixel_format}")
    
    # Create OCR engine with Chinese
    engine = OcrEngine.try_create_from_user_profile_languages()
    if engine is None:
        print("  ERROR: Cannot create OCR engine")
        return ""
    
    print(f"  Engine language: {engine.recognizer_language}")
    
    # Recognize
    print("  Recognizing...")
    result = await engine.recognize_async(software_bitmap)
    text = result.text
    
    print(f"  Result ({len(text)} chars):")
    if text:
        print(text[:300])
    else:
        print("  (empty)")
    
    # Print individual lines
    if text and result.lines:
        for i, line in enumerate(result.lines):
            print(f"  L{i+1}: {line.text}")
    
    return text

async def create_test_image():
    """Create a test image with Chinese text."""
    print("=== Creating test image with Chinese text ===")
    img = Image.new('RGB', (800, 200), color='white')
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
                font = ImageFont.truetype(fp, 36)
                print(f"  Font: {fp}")
                break
            except:
                pass
    
    if font is None:
        font = ImageFont.load_default()
    
    draw.text((50, 50), "从趋势到增长 数字董事会", fill='black', font=font)
    draw.text((50, 120), "2024年方二教授演讲PPT", fill='black', font=font)
    
    test_path = r"C:\Users\Lenovo\ZCodeProject\test_chinese.png"
    img.save(test_path)
    print(f"  Saved: {test_path}")
    return test_path

async def main():
    # Step 1: Test OCR
    test_path = await create_test_image()
    test_text = await ocr_image_file(test_path)
    
    if test_text and test_text.strip():
        print(f"\n✓ OCR Test PASSED - got {len(test_text)} chars")
    else:
        print(f"\n✗ OCR Test produced no output - system may not support Chinese OCR")
        # Check available languages
        print("\nAvailable recognizer languages:")
        # Try to access available languages
        try:
            for lang in OcrEngine.available_recognizer_languages:
                print(f"  - {lang}")
        except Exception as e:
            print(f"  Cannot list: {e}")
        return
    
    # Step 2: Process actual PDF pages
    print("\n\n=== Processing PDF page images ===")
    image_dir = r"C:\Users\Lenovo\ZCodeProject\pdf_images"
    
    if not os.path.exists(image_dir):
        print(f"Directory not found: {image_dir}")
        return
    
    images = sorted([f for f in os.listdir(image_dir) if f.endswith('.png')])
    print(f"Found {len(images)} pages")
    
    all_text = []
    
    for img_name in images:
        img_path = os.path.join(image_dir, img_name)
        page_text = await ocr_image_file(img_path)
        
        if page_text:
            all_text.append(f"\n=== Page {img_name} ===\n{page_text}")
    
    # Save results
    output_path = r"C:\Users\Lenovo\ZCodeProject\pdf_ocr_result.txt"
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(''.join(all_text))
    
    print(f"\n\n{'='*50}")
    print(f"FULL OCR RESULT saved to: {output_path}")
    print(f"Total text length: {sum(len(t) for t in all_text)}")
    print(f"{'='*50}")
    
    if all_text:
        print("\n=== FULL TEXT PREVIEW ===")
        print(''.join(all_text)[:2000])

if __name__ == "__main__":
    asyncio.run(main())
