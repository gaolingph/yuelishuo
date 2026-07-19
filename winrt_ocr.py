"""
Use Windows.Media.Ocr API (via winrt) to perform OCR on extracted PDF page images.
Windows 10+ has built-in Chinese OCR support.
"""
import asyncio
import os
import sys
from PIL import Image

# winrt imports
from winrt.windows.media.ocr import OcrEngine, OcrLine, OcrWord
from winrt.windows.globalization import Language
from winrt.windows.graphics.imaging import SoftwareBitmap, BitmapPixelFormat
from winrt.windows.storage.streams import InMemoryRandomAccessStream

import io

async def ocr_image(image_path):
    """OCR a single image using Windows OCR API."""
    print(f"\nProcessing: {image_path}")
    
    # Open image with PIL and convert to RGB
    img = Image.open(image_path)
    print(f"  Image size: {img.size}, mode: {img.mode}")
    
    # Convert to BGRA8 format (Windows OCR expects this)
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
    
    # Save to bytes stream
    with io.BytesIO() as stream:
        img.save(stream, format='PNG')
        img_bytes = stream.getvalue()
    
    # Create in-memory stream from bytes
    mem_stream = InMemoryRandomAccessStream()
    mem_stream.write_async(img_bytes).wait()
    mem_stream.seek(0)
    
    # Decode the image to SoftwareBitmap
    from winrt.windows.graphics.imaging import BitmapDecoder, BitmapPixelFormat
    
    decoder = BitmapDecoder.create_async(mem_stream).wait()
    software_bitmap = decoder.get_software_bitmap().wait()
    
    # Convert to required format
    if software_bitmap.bitmap_pixel_format != BitmapPixelFormat.BGRA8:
        software_bitmap = SoftwareBitmap.convert(software_bitmap, BitmapPixelFormat.BGRA8)
    
    # Create OCR engine for Chinese (Simplified)
    language = Language("zh-Hans-CN")
    if not OcrEngine.is_language_supported(language):
        print("  WARNING: zh-Hans-CN not supported! Trying without language...")
        ocr_engine = OcrEngine.try_create_from_language(language)
        if ocr_engine is None:
            print("  Failed to create OCR engine for zh-Hans-CN")
            # Try default
            ocr_engine = OcrEngine.try_create_from_user_profile_languages()
            print(f"  Default OCR languages: {[lang.language_tag for lang in ocr_engine.available_recognizer_languages]}")
    else:
        print(f"  zh-Hans-CN supported!")
        ocr_engine = OcrEngine.try_create_from_language(language)
    
    if ocr_engine is None:
        print("  ERROR: Cannot create OCR engine")
        return ""
    
    print(f"  OCR Engine language: {ocr_engine.recognizer_language.language_tag}")
    
    # Recognize
    result = ocr_engine.recognize_async(software_bitmap).wait()
    
    # Extract text
    text = result.text
    print(f"  Recognized text length: {len(text)} chars")
    print(f"  Text preview: {text[:200]}...")
    
    # Also show lines with confidence
    if result.lines:
        print(f"  Lines detected: {len(result.lines)}")
        for i, line in enumerate(result.lines):
            print(f"    Line {i+1}: [{line.text[:100]}] (words: {len(line.words)})")
    
    return text

async def main():
    image_dir = r"C:\Users\Lenovo\ZCodeProject\pdf_images"
    
    # Check if directory exists
    if not os.path.exists(image_dir):
        print(f"Directory not found: {image_dir}")
        return
    
    # Get image files sorted
    image_files = sorted([
        os.path.join(image_dir, f) 
        for f in os.listdir(image_dir) 
        if f.endswith('.png')
    ])
    
    print(f"Found {len(image_files)} images")
    
    if not image_files:
        print("No images found!")
        return
    
    all_text = []
    
    for img_path in image_files:
        text = await ocr_image(img_path)
        all_text.append(f"\n=== Page {os.path.basename(img_path)} ===\n{text}")
    
    # Save all text to a file
    output_path = r"C:\Users\Lenovo\ZCodeProject\pdf_ocr_result.txt"
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(all_text))
    
    print(f"\n\nAll text saved to: {output_path}")
    print(f"\n=== FULL TEXT ===\n{''.join(all_text)}")

if __name__ == "__main__":
    asyncio.run(main())
