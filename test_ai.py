import urllib.request, json

# Login
login_data = json.dumps({"username": "teststudent", "password": "123456"}).encode()
req = urllib.request.Request("http://localhost:8000/api/auth/login", data=login_data, headers={"Content-Type": "application/json"})
resp = urllib.request.urlopen(req)
token = json.loads(resp.read())["access_token"]
print(f"Token: {token[:40]}...")

# Test AI chat
chat_data = json.dumps({"message": "你好"}).encode()
req2 = urllib.request.Request(
    "http://localhost:8000/api/ai/chat",
    data=chat_data,
    headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"}
)
try:
    resp2 = urllib.request.urlopen(req2)
    result = json.loads(resp2.read())
    print(f"AI Response: {result}")
except urllib.error.HTTPError as e:
    print(f"HTTP Error {e.code}: {e.read().decode()}")
except Exception as e:
    print(f"Error: {e}")
