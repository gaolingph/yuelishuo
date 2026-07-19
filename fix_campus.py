import sqlite3
c = sqlite3.connect(r"C:\Users\Lenovo\ZCodeProject\backend\data\db\vocab_system.db")
cur = c.cursor()

# Assign all students with NULL campus_id to campus 1
cur.execute("UPDATE users SET campus_id=1 WHERE role='student' AND campus_id IS NULL")
print(f"Updated {cur.rowcount} students")

# Also assign testparent to campus 1
cur.execute("UPDATE users SET campus_id=1 WHERE role='parent' AND campus_id IS NULL")
print(f"Updated {cur.rowcount} parents")

c.commit()
c.close()
print("Done")
