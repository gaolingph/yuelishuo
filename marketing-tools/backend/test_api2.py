"""API集成测试"""
import http.client
import json

HOST = 'localhost'
PORT = 8080

def api(method, path, data=None, token=None):
    conn = http.client.HTTPConnection(HOST, PORT)
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    body = json.dumps(data, ensure_ascii=False).encode() if data else None
    conn.request(method, path, body, headers)
    r = conn.getresponse()
    resp = json.loads(r.read().decode())
    conn.close()
    print(f'{method} {path} → {r.status} ', end='')
    if r.status == 200:
        print('✓')
    else:
        print(f'✗ {resp.get("detail", resp)[:80]}')
    return resp, r.status

# 1. Login
print('='*50)
print('1. 登录')
print('='*50)
resp, _ = api('POST', '/api/auth/login', {'phone': '13800000000', 'code': '888888'})
token = resp.get('token', '')
print(f'   用户: {resp["user"]["display_name"]} ({resp["user"]["role"]})')
print(f'   校区: {resp["campus"]["name"]}')
print()

# 2. 获取校区列表
print('='*50)
print('2. 校区列表')
print('='*50)
resp, _ = api('GET', '/api/campus', token=token)
print(f'   校区数: {len(resp) if isinstance(resp, list) else 0}')
if isinstance(resp, list):
    for c in resp:
        print(f'   - {c["name"]} ({c.get("code","")})')
print()

# 3. 创建线索
print('='*50)
print('3. 创建线索')
print('='*50)
resp, _ = api('POST', '/api/leads', {
    'name': '王小明家长',
    'phone': '13812345678',
    'source': 'friend_referral',
    'grade': '五年级',
    'subjects': ['english'],
    'notes': '对单词速记感兴趣'
}, token=token)
lead_id = resp.get('id')
print(f'   线索ID: {lead_id} -> {resp.get("name", "?")}')
print()

# 4. 获取线索列表
print('='*50)
print('4. 线索列表')
print('='*50)
resp, _ = api('GET', '/api/leads', token=token)
print(f'   线索数: {len(resp) if isinstance(resp, list) else 0}')
print()

# 5. 创建成交记录
print('='*50)
print('5. 创建成交记录')
print('='*50)
resp, _ = api('POST', '/api/deals', {
    'lead_id': lead_id,
    'course_name': '英语单词速记·春季集训班',
    'amount': 3980.00,
    'notes': '家长对课程很满意'
}, token=token)
deal_id = resp.get('id')
print(f'   成交ID: {deal_id} -> ¥{resp.get("amount", 0)}')
print()

# 6. 成交统计
print('='*50)
print('6. 成交统计')
print('='*50)
resp, _ = api('GET', '/api/deals/stats', token=token)
print(f'   total_deals: {resp.get("total_deals", 0)}, total_amount: ¥{resp.get("total_amount", 0)}')
print()

# 7. 佣金记录
print('='*50)
print('7. 佣金记录')
print('='*50)
resp, _ = api('GET', '/api/commission/records', token=token)
if isinstance(resp, list):
    print(f'   佣金记录数: {len(resp)}')
    for r in resp:
        print(f'   - ¥{r.get("commission_amount", 0)} ({r.get("status", "?")})')
print()

# 8. 审计日志
print('='*50)
print('8. 审计日志')
print('='*50)
resp, _ = api('GET', '/api/audit-logs', token=token)
if isinstance(resp, list):
    print(f'   日志数: {len(resp)}')
    for r in resp[:3]:
        print(f'   - [{r.get("action_type","?")}] {r.get("target_type","?")}#{r.get("target_id","?")} -> {r.get("field_name","")}')
print()

# 9. 统计概览
print('='*50)
print('9. 统计概览')
print('='*50)
resp, _ = api('GET', '/api/stats/overview', token=token)
print(f'   leads: {resp.get("total_leads", 0)}, deals: {resp.get("total_deals", 0)}, revenue: ¥{resp.get("total_revenue", 0)}')
print()

# 10. 获取佣金规则
print('='*50)
print('10. 佣金规则')
print('='*50)
resp, _ = api('GET', '/api/commission/rules', token=token)
if isinstance(resp, list):
    print(f'   规则数: {len(resp)}')
    for r in resp:
        print(f'   - {r.get("name","")}: {r.get("commission_type","")} = {r.get("commission_value","")}')
print()

print('='*50)
print('✅ 所有测试完成！')
print('='*50)
