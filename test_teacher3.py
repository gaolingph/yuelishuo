import sqlite3
c = sqlite3.connect(r"C:\Users\Lenovo\ZCodeProject\backend\data\db\vocab_system.db")
cur = c.cursor()

cur.execute("SELECT * FROM groups")
print("Groups:", cur.fetchall())

cur.execute("SELECT * FROM campuses")
print("Campuses:", cur.fetchall())

cur.execute("SELECT id, username, role, group_id, campus_id FROM users")
print("\nAll users:")
for r in cur.fetchall():
    print(f"  id={r[0]} user={r[1]} role={r[2]} group={r[3]} campus={r[4]}")

# Check students specifically
cur.execute("SELECT id, username, campus_id FROM users WHERE role='student'")
print("\nStudents:")
for r in cur.fetchall():
    print(f"  id={r[0]} user={r[1]} campus={r[2]}")

c.close()
