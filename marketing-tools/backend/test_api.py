"""快速测试 API"""
import urllib.request
import json
import sys

HOST = "http://localhost:8080"

def test(desc, method, path, data=None, token=None):
    url = f"{HOST}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    
    try:
        r = urllib.request.urlopen(req)
        resp = json.loads(r.read())
        print(f"✓ {desc}")
        return resp
    except urllib.error.HTTPError as e:
        print(f"✗ {desc}: HTTP {e.code}")
        print(f"  Response: {e.read().decode()[:200]}")
        return None

# 1. Health
print("=" * 50)
print("1. 健康检查")
print("=" * 50)
test("GET /api/health", "GET", "/api/health")

# 2. Login
print("\n" + "=" * 50)
print("2. 登录测试")
print("=" * 50)
resp = test("POST /api/auth/login", "POST", "/api/auth/login", {
    "phone": "13800000000",
    "code": "888888"
})

if resp and "access_token" in resp:
    token = resp["access_token"]
    print(f"   用户: {resp['user']['display_name']} ({resp['user']['role']})")
    print(f"   校区: {resp.get('campus', {}).get('name', 'N/A')}")
    print(f"   Token: {token[:40]}...")
    
    # 3. Get leads
    print("\n" + "=" * 50)
    print("3. 获取线索列表")
    print("=" * 50)
    test("GET /api/leads", "GET", "/api/leads", token=token)
    
    # 4. Get stats
    print("\n" + "=" * 50)
    print("4. 获取概览统计")
    print("=" * 50)
    test("GET /api/stats/overview", "GET", "/api/stats/overview", token=token)
    
    # 5. Get campuses
    print("\n" + "=" * 50)
    print("5. 获取校区列表")
    print("=" * 50)
    test("GET /api/campuses", "GET", "/api/campuses", token=token)
    
    # 6. Get deals stats
    print("\n" + "=" * 50)
    print("6. 获取成交统计")
    print("=" * 50)
    test("GET /api/deals/stats", "GET", "/api/deals/stats", token=token)
    
    # 7. Create a lead
    print("\n" + "=" * 50)
    print("7. 创建线索")
    print("=" * 50)
    resp2 = test("POST /api/leads", "POST", "/api/leads", {
        "name": "测试家长",
        "phone": "13800138000",
        "source": "manual",
        "grade": "三年级",
        "subjects": ["english"]
    }, token=token)
    
    if resp2 and "id" in resp2:
        lead_id = resp2["id"]
        print(f"   线索ID: {lead_id}")
        
        # 8. Create deal
        print("\n" + "=" * 50)
        print("8. 创建成交记录")
        print("=" * 50)
        test("POST /api/deals", "POST", "/api/deals", {
            "lead_id": lead_id,
            "course_name": "英语单词速记春季班",
            "amount": 2980.00,
            "notes": "首次成交"
        }, token=token)
        
        # 9. Check commission
        print("\n" + "=" * 50)
        print("9. 佣金记录")
        print("=" * 50)
        test("GET /api/commission/records", "GET", "/api/commission/records", token=token)
        
        # 10. Audit logs
        print("\n" + "=" * 50)
        print("10. 审计日志")
        print("=" * 50)
        test("GET /api/audit-logs", "GET", "/api/audit-logs", token=token)

else:
    print("登录失败，跳过后续测试")

print("\n" + "=" * 50)
print("测试完成")
print("=" * 50)
