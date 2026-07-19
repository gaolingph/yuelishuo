import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))
from config import settings
print(f'SMS_SIGN_NAME: {settings.SMS_SIGN_NAME}')
from database import engine
from sqlalchemy import text
with engine.connect() as conn:
    r = conn.execute(text('SELECT id, name, address, phone, contact_person FROM campuses WHERE id=2')).fetchall()
    for row in r:
        print(f'校区: id={row[0]}, name={row[1]}, address={row[2]}, phone={row[3]}, contact={row[4]}')
    r = conn.execute(text('SELECT id, name, city, district FROM schools LIMIT 3')).fetchall()
    for row in r:
        print(f'学校: id={row[0]}, name={row[1]}, city={row[2]}, district={row[3]}')
