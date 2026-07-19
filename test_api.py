import urllib.request, json

# Login
login_data = json.dumps({'username': 'teststudent', 'password': '123456'}).encode()
req = urllib.request.Request('http://localhost:8080/api/auth/login', data=login_data,
                              headers={'Content-Type': 'application/json'})
resp = urllib.request.urlopen(req, timeout=10)
token = json.loads(resp.read())['access_token']
print(f'Token: {token[:30]}...')

# Test practice/choice
req = urllib.request.Request('http://localhost:8080/api/practice/choice?count=2',
                              headers={'Authorization': f'Bearer {token}'})
try:
    resp = urllib.request.urlopen(req, timeout=10)
    data = json.loads(resp.read())
    print(f'practice/choice OK: {len(data)} questions')
except Exception as e:
    print(f'practice/choice ERROR: {e}')

# Test practice/spelling
req = urllib.request.Request('http://localhost:8080/api/practice/spelling?count=2',
                              headers={'Authorization': f'Bearer {token}'})
try:
    resp = urllib.request.urlopen(req, timeout=10)
    data = json.loads(resp.read())
    print(f'practice/spelling OK: {len(data)} questions')
except Exception as e:
    print(f'practice/spelling ERROR: {e}')

# Test practice/listening
req = urllib.request.Request('http://localhost:8080/api/practice/listening?count=2',
                              headers={'Authorization': f'Bearer {token}'})
try:
    resp = urllib.request.urlopen(req, timeout=10)
    data = json.loads(resp.read())
    print(f'practice/listening OK: {len(data)} questions')
except Exception as e:
    print(f'practice/listening ERROR: {e}')

# Test pk/start
req = urllib.request.Request('http://localhost:8080/api/pk/start',
                              headers={'Authorization': f'Bearer {token}'})
try:
    resp = urllib.request.urlopen(req, timeout=10)
    data = json.loads(resp.read())
    print(f'pk/start OK: {len(data.get("words", []))} words')
except Exception as e:
    print(f'pk/start ERROR: {e}')

# Test packs
req = urllib.request.Request('http://localhost:8080/api/packs',
                              headers={'Authorization': f'Bearer {token}'})
try:
    resp = urllib.request.urlopen(req, timeout=10)
    data = json.loads(resp.read())
    print(f'packs OK: {len(data)} packs')
except Exception as e:
    print(f'packs ERROR: {e}')

# Test packs/1 (this might fail - 404 expected if no endpoint)
req = urllib.request.Request('http://localhost:8080/api/packs/1',
                              headers={'Authorization': f'Bearer {token}'})
try:
    resp = urllib.request.urlopen(req, timeout=10)
    data = json.loads(resp.read())
    print(f'packs/1 OK: {data}')
except Exception as e:
    print(f'packs/1 ERROR: {e}')
