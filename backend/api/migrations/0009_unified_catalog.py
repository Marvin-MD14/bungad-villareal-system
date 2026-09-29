from django.db import migrations

def migrate_catalogs_to_unified_items(apps, schema_editor):
    Company = apps.get_model('api', 'Company')
    BusinessType = apps.get_model('api', 'BusinessType')
    Business = apps.get_model('api', 'Business')
    Category = apps.get_model('api', 'Category')
    Item = apps.get_model('api', 'Item')
    BusinessItem = apps.get_model('api', 'BusinessItem')
    InventoryLevel = apps.get_model('api', 'InventoryLevel')
    StockMovement = apps.get_model('api', 'StockMovement')

    Product = apps.get_model('api', 'Product')
    VSSService = apps.get_model('api', 'VSSService')
    VRealProduct = apps.get_model('api', 'VRealProduct')
    BBProduct = apps.get_model('api', 'BBProduct')
    PangananMenu = apps.get_model('api', 'PangananMenu')
    KBItem = apps.get_model('api', 'KBItem')
    AutoSpaService = apps.get_model('api', 'AutoSpaService')
    BranchInventory = apps.get_model('api', 'BranchInventory')

    # Ensure Business Types
    spa_type, _ = BusinessType.objects.get_or_create(
        code='spa',
        defaults={'name': 'Spa & Wellness', 'icon': 'sparkles', 'default_unit': 'session', 'tracks_stock': False}
    )
    retail_type, _ = BusinessType.objects.get_or_create(
        code='retail',
        defaults={'name': 'Retail & Cosmetics', 'icon': 'shopping-bag', 'default_unit': 'pc', 'tracks_stock': True}
    )
    resto_type, _ = BusinessType.objects.get_or_create(
        code='restaurant',
        defaults={'name': 'Restaurant / Food', 'icon': 'utensils', 'default_unit': 'order', 'tracks_stock': True}
    )
    auto_type, _ = BusinessType.objects.get_or_create(
        code='auto-spa',
        defaults={'name': 'Auto Spa & Detailing', 'icon': 'car', 'default_unit': 'service', 'tracks_stock': True}
    )

    # Ensure Businesses
    vss_biz, _ = Business.objects.get_or_create(
        slug='vss',
        defaults={'name': 'Villareal Spa Services', 'business_type': spa_type, 'is_active': True}
    )
    vreal_biz, _ = Business.objects.get_or_create(
        slug='vreal',
        defaults={'name': 'VReal Products', 'business_type': retail_type, 'is_active': True}
    )
    bb_biz, _ = Business.objects.get_or_create(
        slug='bb',
        defaults={'name': 'BB Retail', 'business_type': retail_type, 'is_active': True}
    )
    panganan_biz, _ = Business.objects.get_or_create(
        slug='panganan',
        defaults={'name': 'Panganan Menu', 'business_type': resto_type, 'is_active': True}
    )
    kb_biz, _ = Business.objects.get_or_create(
        slug='kb',
        defaults={'name': 'KB Items', 'business_type': retail_type, 'is_active': True}
    )
    autospa_biz, _ = Business.objects.get_or_create(
        slug='autospa',
        defaults={'name': 'Auto Spa Services', 'business_type': auto_type, 'is_active': True}
    )

    category_cache = {}
    def get_or_create_cat(name, kind):
        clean_name = (name or 'General').strip()
        key = (clean_name, kind)
        if key not in category_cache:
            cat, _ = Category.objects.get_or_create(
                name=clean_name,
                kind=kind,
                defaults={'is_active': True}
            )
            category_cache[key] = cat
        return category_cache[key]

    # Part 1: VSS & VReal
    for svc in VSSService.objects.all():
        cat = get_or_create_cat(svc.category or 'Spa Services', 'SERVICE')
        item, _ = Item.objects.get_or_create(
            name=svc.description.strip(),
            item_type='SERVICE',
            defaults={
                'category': cat,
                'selling_price': svc.price,
                'cost_price': 0,
                'tracks_stock': False,
                'unit': 'session',
                'is_active': svc.is_active,
            }
        )
        BusinessItem.objects.get_or_create(
            business=vss_biz,
            item=item,
            defaults={'is_available': svc.is_active}
        )

    for vp in VRealProduct.objects.all():
        cat = get_or_create_cat(vp.category or 'Cosmetics', 'PRODUCT')
        attrs = {'size': vp.size} if vp.size else {}
        item, _ = Item.objects.get_or_create(
            name=vp.product.strip(),
            item_type='PRODUCT',
            defaults={
                'category': cat,
                'selling_price': vp.price,
                'cost_price': 0,
                'tracks_stock': True,
                'unit': 'pc',
                'attributes': attrs,
                'is_active': vp.is_active,
            }
        )
        BusinessItem.objects.get_or_create(
            business=vreal_biz,
            item=item,
            defaults={'is_available': vp.is_active}
        )

    # Part 2: BB, Panganan, KB, AutoSpa
    for bp in BBProduct.objects.all():
        cat = get_or_create_cat(bp.category or 'BB Products', 'PRODUCT')
        item, _ = Item.objects.get_or_create(
            name=bp.product_name.strip(),
            item_type='PRODUCT',
            defaults={
                'category': cat,
                'selling_price': bp.price,
                'cost_price': 0,
                'tracks_stock': True,
                'unit': 'pc',
                'is_active': bp.is_active,
            }
        )
        BusinessItem.objects.get_or_create(
            business=bb_biz,
            item=item,
            defaults={'is_available': bp.is_active}
        )

    for pm in PangananMenu.objects.all():
        cat = get_or_create_cat(pm.category or 'Food & Drinks', 'PRODUCT')
        item, _ = Item.objects.get_or_create(
            name=pm.menu.strip(),
            item_type='PRODUCT',
            defaults={
                'category': cat,
                'selling_price': pm.price,
                'cost_price': 0,
                'tracks_stock': True,
                'unit': 'order',
                'is_active': pm.is_active,
            }
        )
        BusinessItem.objects.get_or_create(
            business=panganan_biz,
            item=item,
            defaults={'is_available': pm.is_active}
        )

    for kb in KBItem.objects.all():
        cat = get_or_create_cat('KB Items', 'PRODUCT')
        item, _ = Item.objects.get_or_create(
            name=kb.name.strip(),
            item_type='PRODUCT',
            defaults={
                'category': cat,
                'selling_price': kb.price,
                'cost_price': 0,
                'tracks_stock': True,
                'unit': 'pc',
                'is_active': kb.is_active,
            }
        )
        BusinessItem.objects.get_or_create(
            business=kb_biz,
            item=item,
            defaults={'is_available': kb.is_active}
        )

    for asvc in AutoSpaService.objects.all():
        cat = get_or_create_cat('Auto Detailing', 'SERVICE')
        item, _ = Item.objects.get_or_create(
            name=asvc.service.strip(),
            item_type='SERVICE',
            defaults={
                'category': cat,
                'selling_price': asvc.price,
                'cost_price': 0,
                'tracks_stock': False,
                'unit': 'service',
                'is_active': asvc.is_active,
            }
        )
        BusinessItem.objects.get_or_create(
            business=autospa_biz,
            item=item,
            defaults={'is_available': asvc.is_active}
        )

    # Part 3: Legacy Product & BranchInventory
    for prod in Product.objects.all():
        cat = get_or_create_cat(prod.category or 'Cosmetics', 'PRODUCT')
        item, _ = Item.objects.get_or_create(
            name=prod.name.strip(),
            item_type='PRODUCT',
            defaults={
                'category': cat,
                'barcode': prod.barcode,
                'cost_price': prod.purchase_price,
                'selling_price': prod.selling_price,
                'min_stock': prod.min_stock,
                'tracks_stock': True,
                'unit': 'pc',
                'is_active': prod.is_active,
            }
        )
        BusinessItem.objects.get_or_create(
            business=vreal_biz,
            item=item,
            defaults={'is_available': prod.is_active}
        )

    for bi in BranchInventory.objects.all():
        matching_item = Item.objects.filter(name=bi.product.name.strip(), item_type='PRODUCT').first()
        if matching_item:
            inv_level, _ = InventoryLevel.objects.get_or_create(
                branch=bi.branch,
                item=matching_item,
                defaults={'stock_qty': max(0, bi.stock_qty)}
            )
            StockMovement.objects.create(
                branch=bi.branch,
                item=matching_item,
                quantity_delta=inv_level.stock_qty,
                reason='RECEIVE',
                reference='OPENING_BALANCE_MIGRATION',
                balance_after=inv_level.stock_qty,
            )

def reverse_catalogs(apps, schema_editor):
    pass

class Migration(migrations.Migration):
    dependencies = [
        ('api', '0008_business_businessitem_businesstype_category_company_and_more'),
    ]
    operations = [
        migrations.RunPython(migrate_catalogs_to_unified_items, reverse_catalogs),
    ]
