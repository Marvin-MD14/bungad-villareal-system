from django.contrib import admin
from .models import Branch, Product, BranchInventory, ClientProfile, RoomTable, UserProfile

admin.site.register(Branch)
admin.site.register(Product)
admin.site.register(BranchInventory)
admin.site.register(ClientProfile)
admin.site.register(RoomTable)
admin.site.register(UserProfile)