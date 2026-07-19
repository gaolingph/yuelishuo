import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

print(f"Current directory: {os.getcwd()}")
print(f"Script directory: {os.path.dirname(os.path.abspath(__file__))}")

from database import engine, Base
# Check what database file the engine connects to
db_url = engine.url
print(f"Database URL: {db_url}")
# Get the actual database path
db_path = db_url.database
print(f"Database path from URL: {db_path}")
# Check if it's a relative path
if not os.path.isabs(db_path):
    full_path = os.path.join(os.getcwd(), db_path)
    print(f"Full path (cwd-based): {full_path}")
    print(f"Exists: {os.path.exists(full_path)}")
