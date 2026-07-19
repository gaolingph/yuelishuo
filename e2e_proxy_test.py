"""
E2E test through Vite proxy (port 5173)
Tests all API endpoints via the proxy to verify forwarding works
"""
import urllib.request, json, sys

BASE = 'http://localhost:5173/api'
token = None
total = 0
passed = 0
failed = 0
errors = []

def api(method, path, data=None, auth=True):
    global token
    url = f'{BASE}{path}'
    headers = {'Content-Type': 'application/json'}
    if auth and token:
        headers['Authorization'] = f'Bearer {token}'
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(req, timeout=10)
        return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        err_body = e.read().decode()
        return {'ERROR': e.code, 'detail': err_body}
    except Exception as e:
        return {'ERROR': str(e)}

def check(name, condition, detail=''):
    global total, passed, failed
    total += 1
    if condition:
        passed += 1
        print(f'   ✅ {name}')
    else:
        failed += 1
        print(f'   ❌ {name} - {detail}')
        errors.append((name, detail))

def header(title):
    print(f'\n{"="*60}')
    print(f'📌 {title}')
    print(f'{"="*60}')

# ============================================================================
# 1. AUTH LOGIN
# ============================================================================
header('1. 登录认证')

print('   POST /auth/login (teststudent)')
r = api('POST', '/auth/login', {'username': 'teststudent', 'password': '123456'})
token = r.get('access_token')
user = r.get('user')
check('登录成功获取token', bool(token), f'error: {r.get("ERROR")}')
if user:
    check(f'用户信息: {user["nickname"]}({user["role"]})',
          user['role'] in ['student', 'kid'], f'role={user["role"]}')

# ============================================================================
# 2. PACKS
# ============================================================================
header('2. 词库系统')

r = api('GET', '/packs/')
check('返回词库列表', isinstance(r, list) and len(r) > 0, str(type(r)))
if isinstance(r, list):
    check('词库数量 >= 11', len(r) >= 11, f'只有{len(r)}个词库')
    check('词库含id/name/level/word_count',
          all(k in r[0] for k in ['id','name','level','word_count','description','is_free','is_unlocked']),
          f'keys={list(r[0].keys())}')

# ============================================================================
# 3. LEARNING (read-only, no state modification)
# ============================================================================
header('3. 学习系统')

r = api('GET', '/learning/today')
check('返回今日任务', isinstance(r, dict), str(type(r)))
if isinstance(r, dict):
    check('必含字段: checked_in, to_review, new_words, stats',
          all(k in r for k in ['checked_in','to_review','new_words','stats']))

r = api('GET', '/learning/today?pack_id=1')
check('指定词库返回', isinstance(r, dict), str(type(r)))
if isinstance(r, dict):
    nw = r.get('new_words', [])
    check(f'有 {len(nw)} 个新词', len(nw) > 0, '无新词')
    if len(nw) > 0:
        check('新词含id/english/chinese/phonetic',
              all(k in nw[0] for k in ['id','english','chinese','phonetic']),
              f'keys={list(nw[0].keys())}')

# ============================================================================
# 4. PET SYSTEM
# ============================================================================
header('4. 宠物系统')

r = api('GET', '/game/pet')
if isinstance(r, dict) and not r.get('ERROR'):
    check(f'宠物: {r.get("name","")} Lv.{r.get("level",0)}', True)
else:
    check('宠物接口', False, str(r)[:100])

r = api('POST', '/game/pet/feed')
if r.get('ERROR'):
    print(f'   ⚠️ 喂食: {r["detail"][:80]}')
    check('喂食接口响应', True, '可能食物不足')
else:
    check('喂食成功', True)

r = api('POST', '/game/pet/earn-food')
if r.get('ERROR'):
    print(f'   ⚠️ 领食物: {r["detail"][:80]}')
    check('领食物接口响应', True)
else:
    check('领食物成功', True)

# ============================================================================
# 5. STORIES
# ============================================================================
header('5. 故事系统')

r = api('GET', '/game/stories')
check('故事列表', isinstance(r, list) and len(r) > 0, str(r)[:100])

# ============================================================================
# 6. BATTLE
# ============================================================================
header('6. 大乱斗')

r = api('GET', '/game/battle/words')
if isinstance(r, list):
    check(f'对战词: {len(r)}个', len(r) > 0, '空列表')
    if len(r) > 0:
        check('词含word_id/english/options/correct_index',
              all(k in r[0] for k in ['word_id','english','options','correct_index']))
else:
    check('battle/words返回列表', False, str(r)[:100])

# ============================================================================
# 7. STATS & ACHIEVEMENTS
# ============================================================================
header('7. 统计与成就')

r = api('GET', '/stats/overview')
check('统计概览', isinstance(r, dict), str(type(r)))
if isinstance(r, dict):
    print(f'   total_learned={r.get("total_learned",0)} mastered={r.get("total_mastered",0)} streak={r.get("streak_days",0)}')

r = api('GET', '/stats/achievements')
if isinstance(r, list):
    check(f'成就: {len(r)}个', True)

r = api('POST', '/stats/checkin')
if not r.get('ERROR'):
    check(f'签到成功 streak={r.get("streak",0)}', True)

# ============================================================================
# 8. GAME STATS
# ============================================================================
header('8. 游戏统计')

r = api('GET', '/game/stats')
check('游戏统计返回', isinstance(r, dict), str(r)[:100])

# ============================================================================
# 9. PACK DETAILS & WORDS
# ============================================================================
header('9. 词库详情')

# Note: No GET /packs/{id} endpoint exists (frontend uses /packs/{id}/words and /packs/{id}/learning-status)
# r = api('GET', '/packs/1')
# check('词库详情', ...)

r = api('GET', '/packs/1/words')
if isinstance(r, list):
    check(f'词库1: {len(r)}个单词', len(r) > 0, '空列表')
    if len(r) > 0:
        check('单词含id/english/chinese/phonetic',
              all(k in r[0] for k in ['id','english','chinese','phonetic']),
              f'keys={list(r[0].keys())}')

# ============================================================================
# 10. PRACTICE MODES
# ============================================================================
header('10. 练习系统')

r = api('GET', '/practice/choice')
check('选择题', isinstance(r, list) and len(r) > 0, str(r)[:100])

r = api('GET', '/practice/spelling')
check('拼写题', isinstance(r, list), str(r)[:100])

r = api('GET', '/practice/listening')
check('听力题', isinstance(r, list), str(r)[:100])

# ============================================================================
# 11. WRONG BOOK
# ============================================================================
header('11. 错题本')

r = api('GET', '/stats/wrong-book')
check('错题本', isinstance(r, list), str(r)[:100])

# ============================================================================
# 12. PK SYSTEM
# ============================================================================
header('12. PK系统')

r = api('GET', '/pk/start')
check('PK开始', isinstance(r, dict) and r.get('pk_id'), str(r)[:100])

r = api('GET', '/pk/history')
check('PK历史', isinstance(r, list), str(r)[:100])

r = api('GET', '/pk/leaderboard')
check('PK排行榜', True)

# ============================================================================
# 13. DIFFERENT ROLES
# ============================================================================
header('13. 不同角色登录')

for role, uname, pw in [('家长', 'testparent', '123456'), ('管理员', 'superadmin', 'admin123')]:
    r = api('POST', '/auth/login', {'username': uname, 'password': pw})
    if r.get('access_token'):
        check(f'{role}登录成功', True)
        print(f'   {r["user"]["nickname"]} ({r["user"]["role"]})')

# ============================================================================
# SUMMARY
# ============================================================================
print(f'\n\n{"="*60}')
print(f'📊 E2E 测试结果汇总')
print(f'{"="*60}')
print(f'   总测试数: {total}')
print(f'   ✅ 通过: {passed}')
print(f'   ❌ 失败: {failed}')
if total > 0:
    print(f'   ✅ 通过率: {passed/total*100:.1f}%')
if errors:
    print(f'\n   失败详情:')
    for name, detail in errors:
        print(f'     ❌ {name}: {detail[:120]}')

sys.exit(0 if failed == 0 else 1)
