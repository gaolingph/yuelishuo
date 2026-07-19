"""
Test Windows.Media.Ocr with a simple generated Chinese text image,
then process the actual PDF page images.
"""
import asyncio
import sys
import os
import io
from PIL import Image, ImageDraw, ImageFont
import tempfile

# ===== STEP 1: Test with generated image =====
async def create_test_image():
    """Create a simple image with Chinese text for testing."""
    print("=== Step 1: Testing with generated Chinese text image ===")
    
    img = Image.new('RGB', (800, 200), color='white')
    draw = ImageDraw.Draw(img)
    
    # Try to find a Chinese font on the system
    font_paths = [
        r"C:\Windows\Fonts\msyh.ttc",    # Microsoft YaHei
        r"C:\Windows\Fonts\simsun.ttc",  # SimSun
        r"C:\Windows\Fonts\msyhbd.ttc",  # Microsoft YaHei Bold
        r"C:\Windows\Fonts\SIMYOU.TTF",  # YouYuan
    ]
    
    font = None
    for fp in font_paths:
        if os.path.exists(fp):
            try:
                font = ImageFont.truetype(fp, 36)
                print(f"  Using font: {fp}")
                break
            except:
                pass
    
    if font is None:
        print("  No Chinese font found, using default")
        font = ImageFont.load_default()
    
    test_text = "从趋势到增长 数字董事会 人工智能 方二教授"
    draw.text((50, 50), test_text, fill='black', font=font)
    draw.text((50, 120), "这是测试文本用于验证OCR功能", fill='black', font=font)
    
    test_path = r"C:\Users\Lenovo\ZCodeProject\test_chinese.png"
    img.save(test_path)
    print(f"  Test image saved to: {test_path}")
    
    return test_path

# ===== STEP 2: OCR using Windows.Media.Ocr =====
async def ocr_with_windows(image_path):
    """OCR an image using Windows.Media.Ocr API via winrt."""
    from winrt.windows.media.ocr import OcrEngine
    from winrt.windows.graphics.imaging import (
        BitmapDecoder, BitmapPixelFormat, SoftwareBitmap
    )
    from winrt.windows.storage.streams import (
        InMemoryRandomAccessStream, FileRandomAccessStream,
        InputStreamOptions
    )
    
    print(f"\n=== OCR Image: {os.path.basename(image_path)} ===")
    
    # Read image file
    with open(image_path, 'rb') as f:
        img_data = f.read()
    
    print(f"  Image size: {len(img_data)} bytes")
    
    # Create stream from bytes
    stream = InMemoryRandomAccessStream()
    stream.write_async(img_data).wait()
    stream.seek(0)
    
    # Decode the SoftwareBitmap
    decoder = BitmapDecoder.create_async(stream).wait()
    software_bitmap = await decoder.get_software_bitmap()
    
    # Convert to BGRA8 if needed
    if software_bitmap.bitmap_pixel_format != BitmapPixelFormat.BGRA8:
        software_bitmap = SoftwareBitmap.convert(software_bitmap, BitmapPixelFormat.BGRA8)
    
    print(f"  Bitmap format: {software_bitmap.bitmap_pixel_format}, size: {software_bitmap.pixel_width}x{software_bitmap.pixel_height}")
    
    # Create OCR engine
    engine = OcrEngine.try_create_from_user_profile_languages()
    if engine is None:
        print("  ERROR: Cannot create OCR engine!")
        return ""
    
    print(f"  Engine language: {engine.recognizer_language}")
    
    # Recognize
    print("  Recognizing...")
    try:
        result = engine.recognize_async(software_bitmap).wait()
    except Exception as e:
        print(f"  ERROR during recognition: {e}")
        import traceback
        traceback.print_exc()
        return ""
    
    text = result.text
    print(f"  Result text ({len(text)} chars):")
    print(f"  === START TEXT ===")
    print(text)
    print(f"  === END TEXT ===")
    
    # Also print lines
    if hasattr(result, 'lines') and result.lines:
        for i, line in enumerate(result.lines):
            print(f"  Line {i+1}: \"{line.text}\"")
    
    return text

# ===== MAIN =====
async def main():
    # First test with the test image
    test_path = await create_test_image()
    test_result = await ocr_with_windows(test_path)
    
    if test_result and len(test_result.strip()) > 0:
        print(f"\n*** TEST PASSED: OCR produced output: '{test_result.strip()[:100]}' ***")
    else:
        print(f"\n*** TEST FAILED: OCR produced no output or error ***")
        # Try with a simpler approach
    
    # Now try the actual PDF page images (first 3 as a test)
    print("\n\n=== Step 2: Processing actual PDF page images ===")
    image_dir = r"C:\Users\Lenovo\ZCodeProject\pdf_images"
    
    if os.path.exists(image_dir):
        images = sorted([f for f in os.listdir(image_dir) if f.endswith('.png')])
        print(f"Found {len(images)} PDF page images")
        
        # Test with just the first image first
        if images:
            first_img = os.path.join(image_dir, images[0])
            print(f"\nProcessing first page: {images[0]}")
            page_result = await ocr_with_windows(first_img)
            if page_result:
                print(f"\nFirst page text ({len(page_result)} chars):")
                print(page_result[:500])
    else:
        print(f"Image directory not found: {image_dir}")
        print(f"Current directory contents: {os.listdir(r'C:\\Users\\Lenovo\\ZCodeProject')}")

if __name__ == "__main__":
    asyncio.run(main())
