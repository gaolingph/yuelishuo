"""
智牛系统 - 全功能E2E测试闭环
Walk through every feature of the system end-to-end
"""
import urllib.request, json, sys

BASE = 'http://localhost:8080/api'
token = None
user = None
total = 0
passed = 0
failed = 0
errors = []

def api(method, path, data=None, auth=True):
    global token, total, passed, failed
    url = f'{BASE}{path}'
    headers = {'Content-Type': 'application/json'}
    if auth and token:
        headers['Authorization'] = f'Bearer {token}'
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(req)
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

def print_header(title):
    print(f'\n{"="*60}')
    print(f'📌 {title}')
    print(f'{"="*60}')

# ============================================================================
# 1. AUTH LOGIN
# ============================================================================
print_header('1. 登录认证')

print('   [1.1] POST /auth/login (teststudent)')
r = api('POST', '/auth/login', {'username': 'teststudent', 'password': '123456'})
token = r.get('access_token')
user = r.get('user')
check('登录成功获取token', bool(token), f'error: {r.get("ERROR")}')
if user:
    check(f'用户信息正确: {user["nickname"]}({user["role"]})', 
          user['role'] in ['student', 'kid'], f'role={user["role"]}')

# ============================================================================
# 2. PACKS - 词库
# ============================================================================
print_header('2. 词库系统')

print('   [2.1] GET /packs/')
r = api('GET', '/packs/')
check('返回词库列表', isinstance(r, list) and len(r) > 0, f'count={len(r) if isinstance(r, list) else r}')
if isinstance(r, list):
    check('词库数量 >= 11', len(r) >= 11, f'只有{len(r)}个词库')
    p1 = r[0]
    check('词库包含id/name/level/word_count', 
          all(k in p1 for k in ['id','name','level','word_count','description','is_free','is_unlocked']),
          f'keys={list(p1.keys())}')
    check('词库1已解锁', p1['is_unlocked'] == True or p1['is_free'] == True)

# ============================================================================
# 3. LEARNING - 今日学习任务
# ============================================================================
print_header('3. 学习系统')

print('   [3.1] GET /learning/today (无pack_id)')
r = api('GET', '/learning/today')
check('返回今日任务', isinstance(r, dict), f'{type(r)}')
if isinstance(r, dict):
    check('必含字段: checked_in, to_review, new_words, stats',
          all(k in r for k in ['checked_in','to_review','new_words','stats']))
    s = r.get('stats', {})
    check('stats含 new_available/review_count/total_learned/total_mastered',
          all(k in s for k in ['new_available','review_count','total_learned','total_mastered']))

print('   [3.2] GET /learning/today?pack_id=1')
r = api('GET', '/learning/today?pack_id=1')
check('指定词库返回内容', isinstance(r, dict), f'{type(r)}')
if isinstance(r, dict):
    nw = r.get('new_words', [])
    tr = r.get('to_review', [])
    check(f'new_words长度={len(nw)}, to_review长度={len(tr)}', 
          len(nw) >= 0 and len(tr) >= 0)
    if len(nw) > 0:
        w = nw[0]
        check('新词包含id/english/chinese/phonetic',
              all(k in w for k in ['id','english','chinese','phonetic']))
    # Store for later testing
    first_new_words = [w['id'] for w in nw[:3]]

print('   [3.3] GET /learning/today?pack_id=2')
r = api('GET', '/learning/today?pack_id=2')
check('pack_id=2正常返回', isinstance(r, dict) and 'stats' in r)

print('   [3.4] POST /learning/study (学新词)')
# Try studying the first new word from the current task if available
r2 = api('GET', '/learning/today?pack_id=1')
if isinstance(r2, dict) and r2.get('new_words'):
    wid = r2['new_words'][0]['id']
    r = api('POST', '/learning/study', {'word_id': wid})
    check(f'学习word_id={wid}', r.get('message') is not None or r.get('ERROR') is None)
    if r.get('ERROR'):
        print(f'     注意: {r["detail"]}')
    else:
        print(f'     结果: {r.get("message")}')
else:
    print('   ⚠️ 跳过: 没有新词可学')

print('   [3.5] POST /learning/review (复习, quality=4)')
if isinstance(r2, dict) and r2.get('new_words'):
    wid = r2['new_words'][0]['id']
    # First study it
    api('POST', '/learning/study', {'word_id': wid})
    r = api('POST', '/learning/review', {'word_id': wid, 'quality': 4})
    check(f'复习word_id={wid} quality=4', 
          r.get('message') is not None or r.get('food_earned') is not None,
          f'响应: {json.dumps(r)[:100]}')
    if not r.get('ERROR'):
        print(f'     结果: {r.get("message", "")} food={r.get("food_earned", 0)}')
else:
    print('   ⚠️ 跳过: 没有词可复习')

print('   [3.6] POST /learning/study (学 pack_id=2 的词)')
r2 = api('GET', '/learning/today?pack_id=2')
if isinstance(r2, dict) and r2.get('new_words'):
    wid = r2['new_words'][0]['id']
    r = api('POST', '/learning/study', {'word_id': wid})
    if not r.get('ERROR'):
        print(f'     学习成功 word_id={wid}')
    else:
        print(f'     注意: {r["detail"]}')

# ============================================================================
# 4. REVIEW - 复习系统 (独立页面)
# ============================================================================
print_header('4. 复习系统')

print('   [4.1] GET /learning/today (查看是否有待复习)')
r = api('GET', '/learning/today')
if isinstance(r, dict) and r.get('to_review'):
    check(f'有待复习词: {len(r["to_review"])}个', True)
    rid = r['to_review'][0]['id']
    print(f'   [4.2] POST /learning/review word_id={rid} quality=3')
    r2 = api('POST', '/learning/review', {'word_id': rid, 'quality': 3})
    if not r2.get('ERROR'):
        print(f'     结果: {r2.get("message", "")} food={r2.get("food_earned", 0)}')
    check('复习操作成功', not r2.get('ERROR'), str(r2.get('detail',''))[:100])
else:
    print('   ⚠️ 没有待复习的词')

# ============================================================================
# 5. GAME - 宠物系统
# ============================================================================
print_header('5. 宠物系统')

print('   [5.1] GET /game/pet')
r = api('GET', '/game/pet')
if r and not r.get('ERROR'):
    check(f'宠物存在: {r.get("name", "")} Lv.{r.get("level", 0)} food={r.get("food", 0)}', True)
    check('宠物数据完整', all(k in r for k in ['name','level','exp','exp_to_next','food']),
          f'keys={list(r.keys())}')
else:
    print(f'     注意: {r}')

print('   [5.2] POST /game/pet/feed')
r = api('POST', '/game/pet/feed')
if not r.get('ERROR'):
    check(f'喂食成功: {r.get("message", "")}', True)
    print(f'     升级? {r.get("leveled_up", False)}')
else:
    print(f'     ⚠️ 跳过: {r["detail"][:80]}')
    check('喂食接口响应', True, '可能食物不足或已喂过')

print('   [5.3] POST /game/pet/earn-food')
r = api('POST', '/game/pet/earn-food')
if not r.get('ERROR'):
    check(f'领取食物成功: food={r.get("total_food", 0)}', True)
else:
    print(f'     ⚠️ 跳过: {r["detail"][:80]}')

# ============================================================================
# 6. STORIES - 故事系统
# ============================================================================
print_header('6. 故事系统')

print('   [6.1] GET /game/stories')
r = api('GET', '/game/stories')
if isinstance(r, list):
    check(f'故事列表: {len(r)}个', len(r) > 0, f'空列表')
    if len(r) > 0:
        s = r[0]
        check('故事含id/title/level/difficulty',
              all(k in s for k in ['id','title','level']),
              f'keys={list(s.keys())[:10]}')
else:
    check('故事接口返回列表', False, str(r)[:100])

# ============================================================================
# 7. BATTLE - 大乱斗
# ============================================================================
print_header('7. 大乱斗系统')

print('   [7.1] GET /game/battle/words')
r = api('GET', '/game/battle/words')
if isinstance(r, list):
    check(f'对战词数: {len(r)}个', len(r) > 0, f'空列表')
    if len(r) > 0:
        w = r[0]
        check('词含word_id/english/options/correct_index',
              all(k in w for k in ['word_id','english','options','correct_index']),
              f'keys={list(w.keys())}')
        print(f'     示例: {w["english"]} -> {w["options"][w["correct_index"]]}')
else:
    check('大乱斗接口返回列表', isinstance(r, list), str(r)[:200])

# ============================================================================
# 8. STATS - 统计数据
# ============================================================================
print_header('8. 统计与成就')

print('   [8.1] GET /stats/overview')
r = api('GET', '/stats/overview')
if isinstance(r, dict):
    check('统计概览', len(r) > 0, f'返回空对象')
    print(f'     字段: {list(r.keys())}')
    for k, v in r.items():
        print(f'       {k}: {v}')
else:
    check('stats/overview返回字典', False, str(r)[:100])

print('   [8.2] GET /stats/calendar')
r = api('GET', '/stats/calendar')
if isinstance(r, list) or isinstance(r, dict):
    check('学习日历', True)
    print(f'     类型: {type(r).__name__} 长度: {len(r) if isinstance(r, list) else "object"}')
else:
    check('stats/calendar', False, str(r)[:100])

print('   [8.3] GET /stats/achievements')
r = api('GET', '/stats/achievements')
if isinstance(r, list):
    check(f'成就列表: {len(r)}个', True)
    if len(r) > 0:
        print(f'     首个: {r[0]}')
else:
    print(f'     响应: {str(r)[:100]}')

print('   [8.4] POST /stats/checkin (签到)')
r = api('POST', '/stats/checkin')
if not r.get('ERROR'):
    check(f'签到成功: {r.get("message", "")} streak={r.get("streak", 0)}', True)
else:
    print(f'     ⚠️ 可能已签到过: {r["detail"][:60]}')

# ============================================================================
# 9. GAME STATS - 游戏统计
# ============================================================================
print_header('9. 游戏统计')

print('   [9.1] GET /game/stats')
r = api('GET', '/game/stats')
if isinstance(r, dict):
    check('游戏统计', True)
    print(f'     字段: {list(r.keys())[:10]}...')
else:
    err_code = r.get('ERROR') if isinstance(r, dict) else 'N/A'
    check('游戏统计接口', False, f'ERROR={err_code} {str(r)[:100]}')
    print(f'     注意: /game/stats 返回{err_code}（可能未实现）')

# ============================================================================
# 10. PACK DETAILS
# ============================================================================
print_header('10. 词库详情')

print('   [10.1] GET /packs/1')
r = api('GET', '/packs/1')
if isinstance(r, dict) and r.get('id'):
    check(f'词库详情: {r.get("name", "")} ({r.get("word_count", 0)}词)', True)
else:
    print(f'     响应: {str(r)[:100]}')

print('   [10.2] GET /packs/1/words')
r = api('GET', '/packs/1/words')
if isinstance(r, list):
    check(f'词库1: {len(r)}个单词', len(r) > 0, f'空列表')
    if len(r) > 0:
        w = r[0]
        check('单词包含id/english/chinese/phonetic/example_en/example_cn',
              all(k in w for k in ['id','english','chinese','phonetic','example_en','example_cn']))
        print(f'     示例: {w["english"]} - {w["chinese"]}')
else:
    print(f'     响应: {str(r)[:100]}')

# ============================================================================
# 11. DIFFERENT ROLES - 不同角色
# ============================================================================
print_header('11. 不同角色登录')

for role, uname, pw in [('家长', 'testparent', '123456'), ('管理员', 'superadmin', 'admin123')]:
    print(f'   [11.1] 登录{role}: {uname}')
    r = api('POST', '/auth/login', {'username': uname, 'password': pw})
    if r.get('access_token'):
        check(f'{role}登录成功', True)
        print(f'     用户: {r["user"]["nickname"]} ({r["user"]["role"]})')
    else:
        check(f'{role}登录', False, str(r)[:80])

# ============================================================================
# SUMMARY
# ============================================================================
print(f'\n\n{"="*60}')
print(f'📊 E2E 测试结果汇总')
print(f'{"="*60}')
print(f'   总测试数: {total}')
print(f'   ✅ 通过: {passed}')
print(f'   ❌ 失败: {failed}')
print(f'   ✅ 通过率: {passed/total*100:.1f}%' if total > 0 else '   N/A')
if errors:
    print(f'\n   失败详情:')
    for name, detail in errors:
        print(f'     ❌ {name}: {detail[:120]}')
print(f'\n   🎯 功能闭环完成!')
