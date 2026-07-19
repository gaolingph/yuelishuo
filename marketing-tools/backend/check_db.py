import sqlite3
import sys
print("Starting check_db.py", file=sys.stderr)
try:
    conn = sqlite3.connect(r'C:\Users\Lenovo\ZCodeProject\marketing-tools\backend\marketing_tools.db')
    print("Connected", file=sys.stderr)
    cursor = conn.execute('SELECT id, phone, sms_code, role, display_name FROM team_members')
    rows = cursor.fetchall()
    print(f"Found {len(rows)} rows", file=sys.stderr)
    for r in rows:
        print(f'id={r[0]}, phone={r[1]}, code={r[2]}, role={r[3]}, name={r[4]}')
    conn.close()
except Exception as e:
    print(f"Error: {e}", file=sys.stderr)
