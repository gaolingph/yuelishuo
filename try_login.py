import urllib.request, json

passwords = ['123456', 'admin', 'admin123', '888888', '666666', '000000', '111111', 'password', 'test1234', 'abc123', 'pass1234']
usernames = ['superadmin', 'campusadmin', 'teststudent', 'testparent']

for user in usernames:
    for pw in passwords:
        data = json.dumps({'username': user, 'password': pw}).encode()
        req = urllib.request.Request('http://localhost:8000/api/auth/login', data=data, headers={'Content-Type': 'application/json'}, method='POST')
        try:
            resp = urllib.request.urlopen(req)
            body = json.loads(resp.read())
            if 'access_token' in body:
                print(f'SUCCESS: {user} / {pw}')
                print(f'  Token: {body["access_token"][:50]}...')
                print(f'  User: {body["user"]}')
        except urllib.error.HTTPError as e:
            if e.code != 401:
                print(f'HTTP {e.code}: {user} / {pw}')
print('Done')
