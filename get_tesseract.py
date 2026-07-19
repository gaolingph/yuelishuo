"""Download a minimal portable Tesseract binary with Chinese support for Windows."""
import urllib.request
import os
import sys
import zipfile
import io
import shutil
import stat

# Try to find a working download URL for a portable Tesseract
# The UB-Mannheim builds are the standard for Windows
# Let's try the GitHub API to find the latest release

def check_url(url, timeout=15):
    """Check if a URL is reachable."""
    try:
        req = urllib.request.Request(url, method='HEAD')
        resp = urllib.request.urlopen(req, timeout=timeout)
        size = resp.headers.get('Content-Length')
        resp.close()
        return True, int(size) if size else None
    except Exception as e:
        return False, str(e)

def download_file(url, dest_path, timeout=600):
    """Download a file with progress indication."""
    print(f"Downloading: {url}")
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        total = int(resp.headers.get('Content-Length', 0))
        downloaded = 0
        with open(dest_path, 'wb') as f:
            while True:
                chunk = resp.read(65536)
                if not chunk:
                    break
                f.write(chunk)
                downloaded += len(chunk)
                if total > 0:
                    pct = downloaded * 100 // total
                    if pct % 10 == 0:
                        mb_dl = downloaded / (1024*1024)
                        mb_total = total / (1024*1024)
                        print(f"  {pct}% ({mb_dl:.1f}MB / {mb_total:.1f}MB)")
    return os.path.getsize(dest_path)

# Strategy 1: Try to download portable tesseract zip
# First check what URLs work
print("=== Checking available download sources ===")

urls = [
    ("Tesseract official win32 zip", 
     "https://github.com/tesseract-ocr/tesseract/releases/download/5.5.0/tesseract-5.5.0-win32-x86_64.zip"),
    ("UB-Mannheim installer", 
     "https://github.com/UB-Mannheim/tesseract/releases/download/v5.4.0.20240606/tesseract-ocr-w64-setup-5.4.0.20240606.exe"),
    ("chinese lang data", 
     "https://github.com/tesseract-ocr/tessdata/raw/main/chi_sim.traineddata"),
    ("chinese simplified fast", 
     "https://github.com/tesseract-ocr/tessdata_fast/raw/main/chi_sim.traineddata"),
]

for name, url in urls:
    ok, info = check_url(url)
    if ok:
        mb = info / (1024*1024) if info else 0
        print(f"  OK: {name} - {mb:.1f}MB: {url[:70]}")
    else:
        print(f"  FAIL: {name} - {info}")

print()

# Strategy: Download portable zip (smaller than installer)
# Try the official win32 zip first
portable_url = "https://github.com/tesseract-ocr/tesseract/releases/download/5.5.0/tesseract-5.5.0-win32-x86_64.zip"
chi_fast_url = "https://github.com/tesseract-ocr/tessdata_fast/raw/main/chi_sim.traineddata"
chi_best_url = "https://github.com/tesseract-ocr/tessdata/raw/main/chi_sim.traineddata"

target_dir = r"C:\Users\Lenovo\ZCodeProject\tesseract_portable"
os.makedirs(target_dir, exist_ok=True)

# Download portable tesseract zip
zip_path = os.path.join(target_dir, "tesseract.zip")
print(f"Downloading portable Tesseract to {zip_path}...")
try:
    size = download_file(portable_url, zip_path)
    print(f"Downloaded {size} bytes")
    
    # Extract
    print("Extracting...")
    with zipfile.ZipFile(zip_path, 'r') as zf:
        zf.extractall(target_dir)
    print("Extraction complete")
    
    # Find tesseract.exe
    for root, dirs, files in os.walk(target_dir):
        for f in files:
            if f.lower() == 'tesseract.exe':
                exe_path = os.path.join(root, f)
                print(f"Found tesseract.exe at: {exe_path}")
                break
except Exception as e:
    print(f"Failed to download/extract portable zip: {e}")
    print("Will try alternative approach...")
    exe_path = None

if not os.path.exists(os.path.join(target_dir, "tesseract.exe")):
    # Maybe the zip didn't have tesseract at root
    for root, dirs, files in os.walk(target_dir):
        for f in files:
            if f.lower() == 'tesseract.exe':
                exe_path = os.path.join(root, f)
                break

if exe_path and os.path.exists(exe_path):
    print(f"\n=== Tesseract found at: {exe_path} ===")
    
    # Download Chinese language data
    tessdata_dir = os.path.join(os.path.dirname(exe_path), "tessdata")
    os.makedirs(tessdata_dir, exist_ok=True)
    
    chi_path = os.path.join(tessdata_dir, "chi_sim.traineddata")
    if not os.path.exists(chi_path):
        print("Downloading Chinese language data (fast version)...")
        try:
            download_file(chi_fast_url, chi_path)
        except:
            print("Fast version failed, trying best version...")
            try:
                download_file(chi_best_url, chi_path)
            except Exception as e:
                print(f"Failed to download Chinese language data: {e}")
    
    # Verify
    import subprocess
    result = subprocess.run([exe_path, "--list-langs"], capture_output=True, text=True, timeout=15)
    print(f"\nAvailable languages:\n{result.stdout}{result.stderr}")
    
    result2 = subprocess.run([exe_path, "--version"], capture_output=True, text=True, timeout=10)
    print(f"Version: {result2.stdout}")
else:
    print("Could not find tesseract.exe after extraction.")
    print(f"Directory contents: {os.listdir(target_dir)}")
