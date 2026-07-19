import urllib.request, json

# Login
req = urllib.request.Request('http://localhost:8080/api/auth/login',
    data=json.dumps({'username': 'teststudent', 'password': '123456'}).encode(),
    headers={'Content-Type': 'application/json'})
token = json.loads(urllib.request.urlopen(req, timeout=10).read())['access_token']

# Test choice
req = urllib.request.Request('http://localhost:8080/api/practice/choice?count=3',
    headers={'Authorization': f'Bearer {token}'})
data = json.loads(urllib.request.urlopen(req, timeout=10).read())
print('=== Choice Q1 ===')
print('Keys:', list(data[0].keys()))
print('options:', data[0]['options'][:3])
print('correct_index:', data[0].get('correct_index'))
print(json.dumps(data[0], ensure_ascii=False, indent=2))

# Test spelling
req = urllib.request.Request('http://localhost:8080/api/practice/spelling?count=3',
    headers={'Authorization': f'Bearer {token}'})
data2 = json.loads(urllib.request.urlopen(req, timeout=10).read())
print('\n=== Spelling Q1 ===')
print('Keys:', list(data2[0].keys()))
print(json.dumps(data2[0], ensure_ascii=False, indent=2))

# Test submit response
req = urllib.request.Request('http://localhost:8080/api/practice/submit',
    data=json.dumps({'word_id': data[0]['word_id'], 'is_correct': True, 'practice_type': 'choice'}).encode(),
    headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'})
resp = json.loads(urllib.request.urlopen(req, timeout=10).read())
print('\n=== Submit response ===')
print(json.dumps(resp, ensure_ascii=False, indent=2))

# Test wrong book
req = urllib.request.Request('http://localhost:8080/api/stats/wrong-book',
    headers={'Authorization': f'Bearer {token}'})
wb = json.loads(urllib.request.urlopen(req, timeout=10).read())
print('\n=== Wrong book ===')
print(json.dumps(wb[:2] if len(wb) > 2 else wb, ensure_ascii=False, indent=2))

# Test PK leaderboard
req = urllib.request.Request('http://localhost:8080/api/pk/leaderboard',
    headers={'Authorization': f'Bearer {token}'})
lb = json.loads(urllib.request.urlopen(req, timeout=10).read())
print('\n=== PK Leaderboard ===')
print(json.dumps(lb[:2] if len(lb) > 2 else lb, ensure_ascii=False, indent=2))

# Test stats/overview
req = urllib.request.Request('http://localhost:8080/api/stats/overview',
    headers={'Authorization': f'Bearer {token}'})
ov = json.loads(urllib.request.urlopen(req, timeout=10).read())
print('\n=== Stats overview ===')
print(json.dumps(ov, ensure_ascii=False, indent=2))
