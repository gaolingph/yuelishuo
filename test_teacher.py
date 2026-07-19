import urllib.request, json

# Login as superadmin
data = json.dumps({"username": "superadmin", "password": "admin123"}).encode()
req = urllib.request.Request("http://localhost:8000/api/auth/login", data=data, headers={"Content-Type": "application/json"})
token = json.loads(urllib.request.urlopen(req).read())["access_token"]
print(f"Login OK, token={token[:30]}...")

headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

# Test 1: class-overview
try:
    req1 = urllib.request.Request("http://localhost:8000/api/teacher/class-overview", headers=headers)
    resp1 = json.loads(urllib.request.urlopen(req1).read())
    print(f"\nclass-overview: {json.dumps(resp1, ensure_ascii=False, indent=2)[:200]}")
except urllib.error.HTTPError as e:
    print(f"\nclass-overview ERROR {e.code}: {e.read().decode()[:200]}")

# Test 2: class-today
try:
    req2 = urllib.request.Request("http://localhost:8000/api/teacher/class-today", headers=headers)
    resp2 = json.loads(urllib.request.urlopen(req2).read())
    print(f"\nclass-today: {json.dumps(resp2, ensure_ascii=False, indent=2)[:200]}")
except urllib.error.HTTPError as e:
    print(f"\nclass-today ERROR {e.code}: {e.read().decode()[:200]}")

# Test 3: students
try:
    req3 = urllib.request.Request("http://localhost:8000/api/teacher/students", headers=headers)
    resp3 = json.loads(urllib.request.urlopen(req3).read())
    print(f"\nstudents count: {len(resp3)}")
    if resp3:
        print(f"first student: {json.dumps(resp3[0], ensure_ascii=False)[:200]}")
except urllib.error.HTTPError as e:
    print(f"\nstudents ERROR {e.code}: {e.read().decode()[:200]}")

# Test 4: alerts
try:
    req4 = urllib.request.Request("http://localhost:8000/api/teacher/students/alerts?min_wrongs=10", headers=headers)
    resp4 = json.loads(urllib.request.urlopen(req4).read())
    print(f"\nalerts count: {len(resp4)}")
except urllib.error.HTTPError as e:
    print(f"\nalerts ERROR {e.code}: {e.read().decode()[:200]}")
