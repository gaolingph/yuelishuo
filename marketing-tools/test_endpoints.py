"""Quick integration test for all API endpoints"""
import urllib.request, json, sys

BASE = "http://localhost:8080"

# Login
req = urllib.request.Request(
    BASE + "/api/auth/login",
    data=b'{"phone":"13800000000","code":"888888"}',
    headers={"Content-Type": "application/json"},
)
r = urllib.request.urlopen(req)
login = json.loads(r.read())
T = login["token"]
print(f'1. LOGIN OK: {login["user"]["display_name"]} ({login["user"]["role"]})')
print(f'   Campus: {login["campus"]["name"]}')

def test(name, path):
    try:
        req = urllib.request.Request(
            BASE + path,
            headers={"Authorization": f"Bearer {T}"},
        )
        r = urllib.request.urlopen(req)
        data = json.loads(r.read())
        if isinstance(data, dict):
            keys = list(data.keys())[:5]
            print(f"   OK {name}: keys={keys}")
        elif isinstance(data, list):
            print(f"   OK {name}: len={len(data)} items")
        else:
            print(f"   OK {name}: {str(data)[:60]}")
    except Exception as e:
        print(f"   FAIL {name}: {e}")

tests = [
    ("stats/overview", "/api/stats/overview"),
    ("leads/pipeline", "/api/leads/stats/pipeline"),
    ("leads list", "/api/leads?page=1&page_size=3"),
    ("deals list", "/api/deals?page=1&page_size=3"),
    ("commission/rules", "/api/commission/rules"),
    ("commission/records", "/api/commission/records?page=1&page_size=3"),
    ("audit-logs", "/api/audit-logs?page=1&page_size=3"),
    ("schools", "/api/schools?page=1&page_size=3"),
    ("video/templates", "/api/video/templates"),
    ("stats/weekly-trend", "/api/stats/weekly-trend"),
    ("stats/owner-perf", "/api/stats/owner-performance"),
    ("stats/funnel", "/api/stats/conversion-funnel"),
    ("campus list", "/api/campus?page=1&page_size=10"),
    ("staff list", "/api/staff?page=1&page_size=10"),
]

for name, path in tests:
    test(name, path)

print("\nALL DONE")
