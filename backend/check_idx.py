import sys, os
sys.path.insert(0, ".")
os.environ["DJANGO_SETTINGS_MODULE"] = "core.settings"
import django
django.setup()

# Check N+1 risks in views - look at UserProfile staffing endpoint
# and AvailabilityMatrixViewSet
from api.catalog.models import BusinessItem
from api.models import UserProfile, Branch, Transaction

# Count records
from django.db import connection

cursor = connection.cursor()

# Check for missing index on ClientProfile.business (used in scoping)
cursor.execute("SELECT sql FROM sqlite_master WHERE name = 'api_clientprofile'")
rows = cursor.fetchall()
if rows:
    print("ClientProfile table DDL (first 300):", rows[0][0][:300] if rows[0][0] else "none")

# Key indexes for ClientProfile
cursor.execute("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='api_clientprofile'")
print("ClientProfile indexes:", [r[0] for r in cursor.fetchall()])

# StockMovement - append-only, should have index on item + created_at
cursor.execute("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='api_stockmovement'")
print("StockMovement indexes:", [r[0] for r in cursor.fetchall()])

# AuditLog indexes
cursor.execute("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='api_auditlog'")
print("AuditLog indexes:", [r[0] for r in cursor.fetchall()])

# Check InventoryLevel indexes
cursor.execute("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='api_inventorylevel'")
print("InventoryLevel indexes:", [r[0] for r in cursor.fetchall()])

# Check for missing index on LoyaltyTransaction
cursor.execute("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='api_loyaltytransaction'")
print("LoyaltyTransaction indexes:", [r[0] for r in cursor.fetchall()])

# Row counts
for table in ["api_transaction", "api_businessitem", "api_stockmovement", "api_auditlog", "api_clientprofile"]:
    cursor.execute(f"SELECT COUNT(*) FROM {table}")
    print(f"{table}: {cursor.fetchone()[0]} rows")
