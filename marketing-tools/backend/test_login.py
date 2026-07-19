"""快速测试 API v2"""
import urllib.request
import json

HOST = "http://localhost:8080"

# Login
req = urllib.request.Request(
    f"{HOST}/api/auth/login",
    data=json.dumps({"phone": "13800000000", "code": "888888"}).encode(),
    headers={"Content-Type": "application/json"},
    method="POST"
)
try:
    r = urllib.request.urlopen(req)
    resp = json.loads(r.read())
    print(f"Status: {r.status}")
    print(f"Response keys: {list(resp.keys())}")
    print(f"Full response: {json.dumps(resp, ensure_ascii=False, indent=2)[:500]}")
    
    if "access_token" in resp:
        print(f"\n✓ Login success! Token: {resp['access_token'][:40]}...")
    elif "token" in resp:
        print(f"\n✓ Login success! Token (key='token'): {resp['token'][:40]}...")
    else:
        print("\n✗ No token found in response")
except urllib.error.HTTPError as e:
    print(f"HTTP Error: {e.code}")
    print(e.read().decode()[:500])
