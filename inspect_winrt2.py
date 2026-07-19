"""Inspect winrt API details - take 2"""
import sys, inspect

print("=== InMemoryRandomAccessStream ===")
from winrt.windows.storage.streams import InMemoryRandomAccessStream

stream = InMemoryRandomAccessStream()
print(f"Type: {type(stream)}")
for attr in dir(stream):
    if not attr.startswith('_'):
        print(f"  {attr}")

print("\n=== Check open_async on FileRandomAccessStream ===")
from winrt.windows.storage.streams import FileRandomAccessStream
f = FileRandomAccessStream.open_async
print(f"Type: {type(f)}")
print(f"Callable: {callable(f)}")
try:
    sig = inspect.signature(f)
    print(f"Signature: {sig}")
except Exception as e:
    print(f"Inspect error: {e}")

print("\n=== Test MemoryStream write ===")
test_data = b"hello world test data"
try:
    op = stream.write_async(test_data)
    print(f"write_async result type: {type(op)}")
    print(f"write_async result: {op}")
    # Try to get the result
    op.wait(5000)  # with timeout in ms
    print("write completed!")
    stream.seek(0)
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()

print("\n=== OcrEngine ===")
from winrt.windows.media.ocr import OcrEngine

# Check static method
print(f"recognize_async (static): {type(OcrEngine.recognize_async)}")
print(f"recognizer_language (static): {type(OcrEngine.recognizer_language)}")

# Check instance
engine = OcrEngine.try_create_from_user_profile_languages()
print(f"\nEngine: {type(engine)}")
if engine:
    for attr in dir(engine):
        if not attr.startswith('_'):
            print(f"  {attr}")
    
    lang = engine.recognizer_language
    print(f"Language: {lang}")

print("\n=== BitmapDecoder ===")
from winrt.windows.graphics.imaging import BitmapDecoder
print(f"create_async type: {type(BitmapDecoder.create_async)}")
try:
    sig = inspect.signature(BitmapDecoder.create_async)
    print(f"Signature: {sig}")
except Exception as e:
    print(f"Inspect error: {e}")

print("\n=== SoftwareBitmap ===")
from winrt.windows.graphics.imaging import SoftwareBitmap
for attr in dir(SoftwareBitmap):
    if not attr.startswith('_'):
        print(f"  {attr}")

print("\nDone.")
