import urllib.request
import os
import sys
import subprocess
import tempfile
import zipfile

TESSERACT_URL = "https://github.com/UB-Mannheim/tesseract/releases/download/v5.4.0.20240606/tesseract-ocr-w64-setup-5.4.0.20240606.exe"
CHI_SIM_TRAINEDDATA = "https://github.com/tesseract-ocr/tessdata/raw/main/chi_sim.traineddata"

def download_file(url, dest_path, desc="file"):
    """Download a file with progress."""
    print(f"Downloading {desc} from {url[:60]}...")
    
    def report(block_num, block_size, total_size):
        downloaded = block_num * block_size
        if total_size > 0:
            percent = min(100, downloaded * 100 // total_size)
            if percent % 10 == 0:
                print(f"  Progress: {percent}% ({downloaded//1024}KB / {total_size//1024}KB)")
    
    # Try using urlretrieve with reporthook
    try:
        urllib.request.urlretrieve(url, dest_path, reporthook=report)
        return True
    except Exception as e:
        print(f"  urlretrieve failed: {e}")
        # Fall back to simple download
        try:
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=300) as resp:
                total = int(resp.headers.get('Content-Length', 0))
                chunk_size = 8192
                downloaded = 0
                with open(dest_path, 'wb') as f:
                    while True:
                        chunk = resp.read(chunk_size)
                        if not chunk:
                            break
                        f.write(chunk)
                        downloaded += len(chunk)
                        if total > 0 and downloaded % (1024*1024) == 0:
                            print(f"  Downloaded {downloaded//1024}KB / {total//1024}KB")
            return True
        except Exception as e2:
            print(f"  Download failed: {e2}")
            return False

def install_tesseract_silent(installer_path):
    """Install Tesseract silently."""
    print("Installing Tesseract silently...")
    install_dir = r"C:\Program Files\Tesseract-OCR"
    result = subprocess.run(
        [installer_path, "/S", f"/D={install_dir}"],
        capture_output=True, text=True, timeout=300
    )
    print(f"  stdout: {result.stdout}")
    print(f"  stderr: {result.stderr}")
    print(f"  returncode: {result.returncode}")
    return result.returncode == 0

# Step 1: Download installer
installer_dir = os.path.join(tempfile.gettempdir(), "tesseract_install")
os.makedirs(installer_dir, exist_ok=True)
installer_path = os.path.join(installer_dir, "tesseract_setup.exe")

print("Step 1: Downloading installer...")
if not download_file(TESSERACT_URL, installer_path, "Tesseract installer"):
    print("FAILED to download installer")
    sys.exit(1)
print(f"Downloaded to {installer_path} ({os.path.getsize(installer_path)} bytes)")

# Step 2: Install
print("\nStep 2: Installing Tesseract...")
if not install_tesseract_silent(installer_path):
    print("Installation may have failed, checking if binary exists anyway...")

tesseract_exe = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
if os.path.exists(tesseract_exe):
    print(f"Tesseract installed at {tesseract_exe}")
else:
    print("Tesseract not found at expected location")
    # Try alternate path
    tesseract_exe = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
    if not os.path.exists(tesseract_exe):
        print("Tesseract binary not found, installation may have failed")
        sys.exit(1)

# Step 3: Add to PATH and download Chinese language data
print("\nStep 3: Ensuring Chinese language data...")
tessdata_dir = r"C:\Program Files\Tesseract-OCR\tessdata"
chi_path = os.path.join(tessdata_dir, "chi_sim.traineddata")

if not os.path.exists(chi_path):
    print(f"Downloading chi_sim.traineddata...")
    download_file(CHI_SIM_TRAINEDDATA, chi_path, "Chinese language data")
else:
    print(f"chi_sim.traineddata already exists ({os.path.getsize(chi_path)} bytes)")

# Step 4: Verify
print("\nStep 4: Verifying Tesseract...")
result = subprocess.run(
    [tesseract_exe, "--list-langs"],
    capture_output=True, text=True, timeout=30
)
print("Available languages:")
print(result.stdout)
print(result.stderr)

result2 = subprocess.run(
    [tesseract_exe, "--version"],
    capture_output=True, text=True, timeout=10
)
print(f"Version: {result2.stdout.strip()}")

print("\nTesseract installation complete!")
