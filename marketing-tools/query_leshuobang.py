import sys
sys.path.insert(0, 'backend')

from database import SessionLocal
from models import Campus, School, TeamMember

db = SessionLocal()

print("=== Campus ===")
for c in db.query(Campus).all():
    print(f"{c.id} | {c.name} | {c.address} | {c.phone} | {c.contact_person}")

print()
print("=== Schools ===")
for s in db.query(School).all():
    print(f"{s.id} | {s.name} | {s.city} {s.district}")

print()
print("=== Team Members ===")
for t in db.query(TeamMember).all():
    print(f"{t.id} | {t.phone} | {t.display_name} | {t.role} | campus={t.campus_id} | school={t.school_id}")

db.close()
