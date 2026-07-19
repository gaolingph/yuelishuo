import urllib.request
import urllib.error
import sys

# Try different URLs for Tesseract
urls = [
    "https://github.com/UB-Mannheim/tesseract/releases/download/v5.5.0.20241111/tesseract-ocr-w64-setup-5.5.0.20241111.exe",
    "https://github.com/UB-Mannheim/tesseract/releases/download/v5.4.0.20240606/tesseract-ocr-w64-setup-5.4.0.20240606.exe",
    "https://github.com/tesseract-ocr/tesseract/releases/download/5.5.0/tesseract-5.5.0-win32-x86_64.zip",
]

for url in urls:
    try:
        print(f"Trying: {url[:80]}...")
        req = urllib.request.Request(url, method='HEAD')
        resp = urllib.request.urlopen(req, timeout=10)
        print(f"  Status: {resp.status}")
        print(f"  Size: {resp.headers.get('Content-Length', 'unknown')}")
        resp.close()
    except Exception as e:
        print(f"  Failed: {e}")

print("\nDone checking URLs")
