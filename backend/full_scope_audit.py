import sys, os, traceback
sys.path.insert(0, ".")
os.environ["DJANGO_SETTINGS_MODULE"] = "core.settings"
import django
django.setup()

try:
    from api.access.scoping import auto_scope
    from django.test import RequestFactory
    from django.contrib.auth.models import User
    from api.access.models import UserAccess
    from api.business.models import Business
    from api.models import (
        Transaction, ClientProfile, RoomTable, Expense, AuditLog,
        UserProfile, CustomerFeedback, Attendance, DailySales
    )
    from api.catalog.models import BusinessItem, InventoryLevel, Item, StockMovement
    from api.loyalty.models import LoyaltyTransaction
    from api.payments.models import Payment, CashierShift

    biz_vss = Business.objects.get(slug="vss")
    biz_bb = Business.objects.get(slug="bb")
    owner = User.objects.get(username="demo_owner")

    factory = RequestFactory()
    request = factory.get("/")
    request.user = owner
    request.company_wide = False
    request.allowed_branch_ids = []
    request._business_context_for = owner.pk
    request.access = UserAccess.objects.filter(user=owner).first()

    models = [
        ("Transaction", Transaction.objects.all(), {}),
        ("ClientProfile", ClientProfile.objects.all(), {}),
        ("RoomTable", RoomTable.objects.all(), {}),
        ("Expense", Expense.objects.all(), {}),
        ("AuditLog", AuditLog.objects.all(), {}),
        ("CustomerFeedback", CustomerFeedback.objects.all(), {}),
        ("Attendance", Attendance.objects.all(), {}),
        ("UserProfile", UserProfile.objects.all(), {}),
        ("BusinessItem", BusinessItem.objects.all(), {}),
        ("InventoryLevel", InventoryLevel.objects.all(), {}),
        ("StockMovement", StockMovement.objects.all(), {}),
        ("LoyaltyTransaction", LoyaltyTransaction.objects.all(), {}),
        ("Payment", Payment.objects.all(), {}),
        ("CashierShift", CashierShift.objects.all(), {}),
        ("DailySales", DailySales.objects.all(), {}),
    ]

    print(f"{'Model':25s} | {'VSS':>6} | {'BB':>6} | Status")
    print("-" * 65)
    for name, qs, kwargs in models:
        try:
            request.business = biz_vss
            vss = auto_scope(qs, request, **kwargs).count()
            request.business = biz_bb
            bb = auto_scope(qs, request, **kwargs).count()
            total = qs.count()
            if vss == bb and vss == total and total > 0:
                status = "UNSCOPED (shows all)"
            elif vss == bb and vss > 0:
                status = "SAME COUNT (check)"
            else:
                status = "OK - differs per business"
            print(f"{name:25s} | {vss:>6} | {bb:>6} | {status}")
        except Exception as e:
            print(f"{name:25s} | ERROR: {e}")
except Exception:
    traceback.print_exc()
