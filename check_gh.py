import urllib.request
import json

# Try tesseract-ocr official releases
url = 'https://api.github.com/repos/tesseract-ocr/tesseract/releases/latest'
try:
    req = urllib.request.Request(url, headers={'Accept': 'application/json'})
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.loads(resp.read())
        print(f'Latest Tesseract release:')
        print(f'  Tag: {data["tag_name"]}')
        print(f'  Name: {data["name"]}')
        for asset in data['assets']:
            name = asset['name']
            size_mb = asset['size'] / (1024*1024)
            print(f'  Asset: {name} ({size_mb:.1f} MB)')
except Exception as e:
    print(f'Tesseract-ocr API error: {e}')

# Try UB-Mannheim releases (they provide Windows builds)
print('\n--- Checking UB-Mannheim releases ---')
url2 = 'https://api.github.com/repos/UB-Mannheim/tesseract/releases?per_page=5'
try:
    req2 = urllib.request.Request(url2, headers={'Accept': 'application/json'})
    with urllib.request.urlopen(req2, timeout=15) as resp2:
        data2 = json.loads(resp2.read())
        for rel in data2:
            print(f'\nRelease: {rel["tag_name"]}')
            for asset in rel['assets']:
                name = asset['name']
                size_mb = asset['size'] / (1024*1024)
                url = asset['browser_download_url']
                print(f'  [{size_mb:.1f}MB] {name}')
except Exception as e:
    print(f'UB-Mannheim API error: {e}')

print('\n--- Checking tessdata release ---')
url3 = 'https://api.github.com/repos/tesseract-ocr/tessdata_fast/releases/latest'
try:
    req3 = urllib.request.Request(url3, headers={'Accept': 'application/json'})
    with urllib.request.urlopen(req3, timeout=15) as resp3:
        data3 = json.loads(resp3.read())
        print(f'Latest tessdata_fast: {data3["tag_name"]}')
except Exception as e:
    print(f'tessdata_fast API error: {e}')
