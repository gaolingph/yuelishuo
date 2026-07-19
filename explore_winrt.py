"""Explore winrt OcrEngine API"""
import sys
from winrt.windows.media.ocr import OcrEngine
import winrt

print('Python version:', sys.version)
print('winrt version:', getattr(winrt, '__version__', 'unknown'))

print('\n=== OcrEngine static methods ===')
for attr in dir(OcrEngine):
    if not attr.startswith('_'):
        print(f'  {attr}')

print('\n=== Available recognizer languages ===')
try:
    langs = OcrEngine.available_recognizer_languages
    print(f'Count: {len(langs)}')
    for l in langs:
        print(f'  Language: {l}')
except Exception as e:
    print(f'Error: {e}')

print('\n=== Try creating engine from user profile ===')
try:
    engine = OcrEngine.try_create_from_user_profile_languages()
    print(f'Engine: {engine}')
    if engine:
        print(f'  recognizer_language: {engine.recognizer_language}')
        print(f'  Engine methods:')
        for attr in dir(engine):
            if not attr.startswith('_'):
                print(f'    {attr}')
except Exception as e:
    print(f'Error: {e}')

print('\n=== Try is_language_supported ===')
try:
    # Test with a BCP-47 tag
    from winrt.windows.media.ocr import OcrEngine
    # Try creating with zh-Hans-CN string
    for lang_tag in ['zh-Hans-CN', 'zh-CN', 'zh', 'en-US', 'ja-JP']:
        try:
            supported = OcrEngine.is_language_supported(lang_tag)
            print(f'  {lang_tag} supported: {supported}')
        except Exception as e:
            print(f'  {lang_tag}: Error - {e}')
except Exception as e:
    print(f'Error: {e}')

print('\nDone.')
