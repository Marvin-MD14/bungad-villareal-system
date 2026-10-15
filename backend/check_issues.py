import sys, os
sys.path.insert(0, ".")
os.environ["DJANGO_SETTINGS_MODULE"] = "core.settings"
import django
django.setup()

issues = []

# 1. N+1 in branch_comparison dashboard endpoint
from django.db import connection, reset_queries
from django.conf import settings
settings.DEBUG = True

# 2. Check AuditLog has no time-based index (critical for paginated queries)
from django.db import connection
cursor = connection.cursor()
cursor.execute("SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='api_auditlog'")
audit_indexes = cursor.fetchall()
has_timestamp_idx = any("timestamp" in (sql or "") or "created" in (name or "") for name, sql in audit_indexes)
if not has_timestamp_idx:
    cursor.execute("SELECT sql FROM sqlite_master WHERE name='api_auditlog'")
    ddl = cursor.fetchone()
    print("AuditLog DDL:", ddl[0][:400] if ddl else "none")
    issues.append("AuditLog: no timestamp index - pagination ORDER BY will be slow")

# 3. Check for missing db_index on Transaction.created_at
cursor.execute("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='api_transaction'")
tx_idx = [r[0] for r in cursor.fetchall()]
print("Transaction indexes:", tx_idx)
has_date_idx = any("created" in i for i in tx_idx)
if not has_date_idx:
    issues.append("Transaction: no created_at index - date range queries will scan full table")

# 4. Check UserProfile - many joins on it
cursor.execute("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='api_userprofile'")
up_idx = [r[0] for r in cursor.fetchall()]
print("UserProfile indexes:", up_idx)

# 5. Check Expense
cursor.execute("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='api_expense'")
exp_idx = [r[0] for r in cursor.fetchall()]
print("Expense indexes:", exp_idx)

# 6. Check CustomerReward
cursor.execute("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='api_customerreward'")
cr_idx = [r[0] for r in cursor.fetchall()]
print("CustomerReward indexes:", cr_idx)
has_cust_idx = any("customer" in i for i in cr_idx)
if not has_cust_idx:
    issues.append("CustomerReward: no customer_id index - reward lookups may be slow")

print("\n=== ISSUES FOUND ===")
for i, issue in enumerate(issues, 1):
    print(f"  {i}. {issue}")
