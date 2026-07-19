import http.client
import json

conn = http.client.HTTPConnection('localhost', 8080)
headers = {'Content-Type': 'application/json'}
body = json.dumps({'phone': '13800000000', 'code': '888888'})
conn.request('POST', '/api/auth/login', body, headers)
r = conn.getresponse()
print(f'Status: {r.status} {r.reason}')
data = r.read().decode()
print(f'Body: {data[:500]}')
conn.close()
