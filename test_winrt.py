"""Quick test of Windows.Media.Ocr API using winrt"""
import asyncio
import sys
from PIL import Image, ImageDraw, ImageFont

def test_windows_ocr():
    """Test if Windows OCR API works at all."""
    print("Testing Windows Media OCR availability...")
    
    try:
        from winrt.windows.media.ocr import OcrEngine
        from winrt.windows.globalization import Language
        
        # Check Chinese support
        chinese = Language("zh-Hans-CN")
        supported = OcrEngine.is_language_supported(chinese)
        print(f"  zh-Hans-CN supported: {supported}")
        
        # Check all available languages
        langs = OcrEngine.available_recognizer_languages
        print(f"  Available languages ({len(langs)}):")
        for lang in langs:
            print(f"    - {lang.language_tag} ({lang.display_name})")
        
        return True
    except ImportError as e:
        print(f"  Import error: {e}")
        return False
    except Exception as e:
        print(f"  Error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    test_windows_ocr()
