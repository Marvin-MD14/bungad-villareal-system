import sys, os, subprocess
sys.path.insert(0, ".")
os.environ["DJANGO_SETTINGS_MODULE"] = "core.settings"
import django
django.setup()

# Check for missing indexes on frequently-queried fields
from django.db import connection

# Run EXPLAIN on a common query to check for full table scans
cursor = connection.cursor()

# Check tables and their row counts
cursor.execute("""
    SELECT name FROM sqlite_master WHERE type="table" ORDER BY name
""")
tables = [row[0] for row in cursor.fetchall()]
print("Tables:", ", ".join(t for t in tables if not t.startswith("sqlite") and not t.startswith("django")))

# Check key indexes
cursor.execute("SELECT name, tbl_name, sql FROM sqlite_master WHERE type='index' ORDER BY tbl_name, name")
indexes = cursor.fetchall()
idx_by_table = {}
for name, tbl, sql in indexes:
    idx_by_table.setdefault(tbl, []).append(name)

# Check BusinessItem indexes (frequently joined)
print("\nBusinessItem indexes:", idx_by_table.get("api_businessitem", []))
print("Transaction indexes:", idx_by_table.get("api_transaction", []))
print("UserAccess indexes:", idx_by_table.get("api_useraccess", []))
print("Branch indexes:", idx_by_table.get("api_branch", []))
