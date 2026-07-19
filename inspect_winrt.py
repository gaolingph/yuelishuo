"""Inspect winrt API details"""
import sys, inspect

print("=== FileRandomAccessStream ===")
from winrt.windows.storage.streams import FileRandomAccessStream

stream = FileRandomAccessStream()
print(f"Type: {type(stream)}")
print(f"Dir:")
for attr in dir(stream):
    if not attr.startswith('_'):
        print(f"  {attr}")

print("\n=== open_async ===")
f = FileRandomAccessStream.open_async
print(f"Type: {type(f)}")
print(f"Callable: {callable(f)}")
try:
    sig = inspect.signature(f)
    print(f"Signature: {sig}")
except Exception as e:
    print(f"Inspect error: {e}")

# Try calling it
print("\n=== Test open_async ===")
test_img = r"C:\Users\Lenovo\ZCodeProject\test_chinese.png"
try:
    result = f(test_img)
    print(f"Result type: {type(result)}")
    print(f"Result: {result}")
    # Check if it's awaitable
    if hasattr(result, '__await__'):
        print("Is awaitable")
    if hasattr(result, 'wait'):
        print(f"wait() sig: {inspect.signature(result.wait)}")
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()

print("\n=== OcrEngine ===")
from winrt.windows.media.ocr import OcrEngine
print(f"recognize_async type: {type(OcrEngine.recognize_async)}")
try:
    sig = inspect.signature(OcrEngine.recognize_async)
    print(f"Signature: {sig}")
except Exception as e:
    print(f"Inspect error: {e}")

# Check instance methods
engine = OcrEngine()
print(f"\nEngine instance type: {type(engine)}")
for attr in dir(engine):
    if not attr.startswith('_'):
        print(f"  {attr}")

print("\n=== BitmapDecoder ===")
from winrt.windows.graphics.imaging import BitmapDecoder
print(f"create_async type: {type(BitmapDecoder.create_async)}")
try:
    sig = inspect.signature(BitmapDecoder.create_async)
    print(f"Signature: {sig}")
except Exception as e:
    print(f"Inspect error: {e}")

print("\nDone.")
