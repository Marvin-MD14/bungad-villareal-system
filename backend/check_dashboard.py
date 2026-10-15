with open("backend/api/views.py", "r", encoding="utf-8") as f:
    content = f.read()

import re

# Find DashboardStatsViewSet class  
idx = content.find("class DashboardStatsViewSet")
# Check if ensure_business_context is called in its methods
dashboard_section = content[idx:idx+5000]
has_ensure = "ensure_business_context" in dashboard_section
print(f"DashboardStatsViewSet has ensure_business_context: {has_ensure}")

# Now check auto_scope - it calls ensure_business_context internally
from_scoping = "ensure_business_context(request)" 
idx2 = content.find("def auto_scope")
if idx2 < 0:
    # Check in scoping.py
    with open("backend/api/access/scoping.py", "r", encoding="utf-8") as f:
        scoping = f.read()
    has_ensure_in_auto_scope = "ensure_business_context" in scoping
    print(f"auto_scope calls ensure_business_context: {has_ensure_in_auto_scope}")
