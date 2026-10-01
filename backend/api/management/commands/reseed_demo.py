# backend/api/management/commands/reseed_demo.py
"""
Rebuild the ENTIRE demo organization from scratch.

Wipes every business/branch/user/grant and all operational rows, then seeds:

  * the singleton Company + the four BusinessTypes (catalog Items are kept);
  * six Businesses, each with branches — except ONE business (``kb``) that is
    deliberately left branch-less so the "business with no branch" case is
    exercised;
  * logins: Superadmin + exactly one Owner, one Business Manager per business
    and, for every branch (or the branch-less business), 1 cashier + 2 staff;
  * dummy operations per staffed branch: inventory + stock ledger, rooms,
    clients, 14 days of paid sales with tendered payments, cashier shifts,
    loyalty ledger entries, DailySales roll-ups, attendance, expenses and
    customer feedback.

The five one-click accounts on the login picker keep their current
usernames/passwords (demo_superadmin, demo_owner, demo_business_manager,
demo_cashier, demo_staff); every generated account follows a fixed password
pattern printed at the end and written to DEMO_LOGINS.md.

    python manage.py reseed_demo

Randomness is seeded, so two runs produce identical data.
"""

import math
import random
from datetime import datetime, time, timedelta
from decimal import Decimal
from pathlib import Path

from django.contrib.auth.models import Group, User
from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.utils import timezone

from api.models import (
    Attendance, AuditLog, Business, BusinessType, Branch, ClientProfile,
    Company, CustomerFeedback, CustomerReward, DailySales, Expense,
    RewardClaim, RoomTable, Transaction, TransactionItem, UserAccess,
    UserProfile,
)
from api.catalog.models import (
    BusinessItem, Category, InventoryLevel, Item, StockMovement,
)
from api.loyalty.models import LoyaltyProgram, LoyaltyTransaction
from api.payments.models import CashierShift, Payment, PaymentMethod

# Deterministic: same data on every run.
RNG = random.Random(20261001)

BUSINESS_TYPES = [
    {'code': 'spa', 'name': 'Spa & Wellness', 'icon': 'sparkles', 'default_unit': 'session', 'tracks_stock': False},
    {'code': 'retail', 'name': 'Retail & Cosmetics', 'icon': 'shopping-bag', 'default_unit': 'pc', 'tracks_stock': True},
    {'code': 'restaurant', 'name': 'Restaurant / Food', 'icon': 'utensils', 'default_unit': 'order', 'tracks_stock': True},
    {'code': 'auto-spa', 'name': 'Auto Spa & Detailing', 'icon': 'car', 'default_unit': 'service', 'tracks_stock': True},
]

# slug -> (name, business_type code)
BUSINESSES = [
    ('vss', 'Villareal Spa Services', 'spa'),
    ('vreal', 'VReal Products', 'retail'),
    ('bb', 'BB Retail', 'retail'),
    ('panganan', 'Panganan Menu', 'restaurant'),
    ('kb', 'KB Items', 'retail'),
    ('autospa', 'Auto Spa Services', 'auto-spa'),
]

# slug -> [(branch code, branch name)]; empty list = business with no branch
BRANCH_PLAN = {
    'vss': [('MAIN', 'Main'), ('DIA', 'Diamond')],
    'vreal': [('MAIN', 'Main'), ('AYL', 'Ayala')],
    'bb': [('MAIN', 'Main')],
    'panganan': [('MAIN', 'Main')],
    'kb': [],                      # the "no branch" case
    'autospa': [('MAIN', 'Main')],
}

PW_MANAGER = 'DemoManager!2026'
PW_CASHIER = 'DemoCashier!2026'
PW_STAFF = 'DemoStaff!2026'

FIRST_NAMES = ['Maria', 'Jose', 'Ana', 'Carlo', 'Divina', 'Eduardo', 'Fatima',
               'Gabriel', 'Hannah', 'Ivan', 'Joy', 'Kevin', 'Liza', 'Marco',
               'Nina', 'Orion', 'Patricia', 'Quennie', 'Ramon', 'Sofia',
               'Teresa', 'Ulysses', 'Vivian', 'Wilma', 'Xander', 'Yara', 'Zeno']
LAST_NAMES = ['Dela Cruz', 'Santos', 'Reyes', 'Bautista', 'Ocampo', 'Salazar',
              'Mendoza', 'Villanueva', 'Aquino', 'Castillo', 'Domigo', 'Enriquez']


class Command(BaseCommand):
    help = ('Wipe and rebuild the demo organization: businesses, branches, '
            'one Business Manager per business, 1 cashier + 2 staff per '
            'branch (or per branch-less business), logins and 14 days of '
            'dummy operations.')

    def add_arguments(self, parser):
        parser.add_argument('--keep-users', action='store_true',
                            help='Keep existing accounts; only seed missing ones.')
        parser.add_argument('--keep-operations', action='store_true',
                            help='Keep sales/attendance/etc.; rebuild org + logins only.')

    def handle(self, *args, **options):
        if not options['keep_users']:
            self._wipe(keep_operations=options['keep_operations'])
        elif not options['keep_operations']:
            self._wipe_operations()
        self._bootstrap_org()
        units = self._staffing(options['keep_users'])
        self._catalog()
        self._operations(units)
        self._write_logins_md(units)
        self._summary(units)

    # ---------------------------------------------------------- wipe

    def _wipe_operations(self):
        """Drop operational rows only (org + accounts stay)."""
        for model in (Payment, CashierShift, LoyaltyTransaction, RewardClaim,
                      CustomerReward, CustomerFeedback, TransactionItem,
                      Transaction, DailySales, Attendance, Expense,
                      InventoryLevel, StockMovement, RoomTable, ClientProfile):
            model.objects.all().delete()
        self.stdout.write('Operational rows wiped.\n')

    def _wipe(self, keep_operations=False):
        if not keep_operations:
            self._wipe_operations()
        # Rows a business deletion would not reach
        BusinessItem.objects.all().delete()
        Business.objects.all().delete()          # cascades branches + tenants
        UserAccess.objects.all().delete()
        AuditLog.objects.all().delete()
        UserProfile.objects.all().delete()
        User.objects.all().delete()              # cascades tokens + profiles
        self.stdout.write('Demo data wiped (company, types and catalog kept).\n')

    # ---------------------------------------------------------- org

    def _bootstrap_org(self):
        company = Company.get_solo()
        company.legal_name = 'Bungad & Villareal Group'
        company.display_name = 'Bungad & Villareal'
        company.default_currency = 'PHP'
        company.timezone = 'Asia/Manila'
        company.save()

        types = {}
        for bt in BUSINESS_TYPES:
            types[bt['code']], _ = BusinessType.objects.get_or_create(
                code=bt['code'],
                defaults={k: bt[k] for k in ('name', 'icon', 'default_unit', 'tracks_stock')},
            )

        self.businesses = {}
        for slug, name, type_code in BUSINESSES:
            business, _ = Business.objects.get_or_create(
                slug=slug,
                defaults={'name': name, 'business_type': types[type_code], 'is_active': True},
            )
            PaymentMethod.ensure_defaults(business)
            LoyaltyProgram.for_business(business)
            self.businesses[slug] = business

        self.branches = {}                     # 'slug_code' -> Branch
        for slug, plan in BRANCH_PLAN.items():
            business = self.businesses[slug]
            if not plan:
                # The post_save signal already gave this business a "Main".
                # For the "no branch" demo we remove that orphan (it has no
                # sales/rooms/stock yet) so staff hang off the business itself.
                business.branches.filter(name='Main').delete()
                continue
            for code, branch_name in plan:
                branch, created = Branch.objects.get_or_create(
                    business=business, name=branch_name, defaults={'code': code},
                )
                # The signal-created "Main" is codeless; adopt the plan code.
                if not created and branch.code != code:
                    branch.code = code
                    branch.save(update_fields=['code'])
                self.branches[f'{slug}_{code.lower()}'] = branch


    # ---------------------------------------------------------- accounts

    def _mkuser(self, username, password, full_name, is_staff=False, is_superuser=False):
        first, _, last = full_name.partition(' ')
        self.creds[username] = password
        return User.objects.create_user(
            username=username, password=password, email=f'{username}@demo.local',
            first_name=first, last_name=last, is_staff=is_staff, is_superuser=is_superuser,
        )

    def _grant(self, user, role, business=None, branches=()):
        group, _ = Group.objects.get_or_create(name=role)
        user.groups.add(group)
        UserProfile.objects.get_or_create(user=user)
        access = UserAccess.objects.create(
            user=user, role=role, business=business, is_primary=True, is_active=True,
        )
        if branches:
            access.branches.set(branches)
        return access

    def _name(self, i):
        return f'{FIRST_NAMES[i % len(FIRST_NAMES)]} {LAST_NAMES[(i * 7) % len(LAST_NAMES)]}'

    def _staffing(self, keep_users):
        self.creds = {}
        # Company-level accounts (the picker keeps these exact credentials)
        if not keep_users or not User.objects.filter(username='demo_superadmin').exists():
            sa = self._mkuser('demo_superadmin', 'DemoSuperadmin!2026',
                              'Sam Superadmin', is_staff=True, is_superuser=True)
            self._grant(sa, 'SUPERADMIN')
        if not keep_users or not User.objects.filter(username='demo_owner').exists():
            ow = self._mkuser('demo_owner', 'DemoOwner!2026',
                              'Olivia Owner', is_staff=True)
            self._grant(ow, 'OWNER')
        self.owner = User.objects.get(username='demo_owner')

        units = []                             # one entry per staffed unit
        name_i = 2
        for slug, _biz_name, _t in BUSINESSES:
            business = self.businesses[slug]

            bm_username = 'demo_business_manager' if slug == 'vss' else f'bm_{slug}'
            bm_password = 'DemoBusinessManager!2026' if slug == 'vss' else PW_MANAGER
            bm = self._mkuser(bm_username, bm_password, self._name(name_i), is_staff=True)
            name_i += 1
            self._grant(bm, 'BUSINESS_MANAGER', business=business)

            unit_keys = ([f'{slug}_{code.lower()}' for code, _n in BRANCH_PLAN[slug]]
                         or [slug])            # no branch -> the business itself
            for key in unit_keys:
                branch = self.branches.get(key)
                cashier_user = 'demo_cashier' if key == 'vss_main' else f'cashier_{key}'
                cashier = self._mkuser(cashier_user, PW_CASHIER, self._name(name_i))
                name_i += 1
                self._grant(cashier, 'CASHIER', business=business,
                            branches=[branch] if branch else [])

                staffs = []
                for n in (1, 2):
                    su = ('demo_staff' if key == 'vss_main' and n == 1
                          else f'staff_{key}_{n}')
                    staff = self._mkuser(su, PW_STAFF, self._name(name_i))
                    name_i += 1
                    self._grant(staff, 'STAFF', business=business,
                                branches=[branch] if branch else [])
                    staffs.append(staff)

                units.append({'key': key, 'business': business, 'branch': branch,
                              'manager': bm, 'cashier': cashier, 'staffs': staffs})
        self.stdout.write(
            f'Accounts ready: {User.objects.count()} users '
            f'({len(units)} staffed units, each 1 cashier + 2 staff).\n'
        )
        return units



    # ---------------------------------------------------------- catalog

    # (name, cost, price) per extra business
    EXTRA_CATALOG = {
        'bb': ('BB Products', 'PRODUCT', [
            ('BB Cream SPF50', 220, 399), ('Matte Lip Tint', 120, 249),
            ('Setting Powder', 180, 329), ('Micellar Water', 150, 279),
            ('Eyebrow Pencil', 90, 179), ('Blush Palette', 200, 379),
            ('Skincare Set', 450, 899), ('Sunscreen Gel', 190, 349)]),
        'kb': ('KB Items', 'PRODUCT', [
            ('Canvas Tote', 150, 299), ('Enamel Mug', 90, 189),
            ('Sticker Pack', 40, 89), ('Keychain Set', 60, 129),
            ('Graphic T-Shirt', 220, 449), ('Snapback Cap', 170, 349)]),
        'panganan': ('Panganan Menu', 'SERVICE', [
            ('Pork Silog', 90, 149), ('Chicken Tanduy', 80, 129),
            ('Bulalo', 180, 289), ('Sisig', 120, 199),
            ('Sinigang na Baboy', 130, 209), ('Lumpiang Shanghai 8pcs', 90, 159),
            ('Pancit Canton', 90, 149), ('Tapsilog', 130, 219),
            ('Extra Rice', 15, 25), ('Iced Tea', 25, 45),
            ('Buko Pandan', 60, 95), ('Crispy Sisig Wings', 140, 229)]),
        'autospa': ('Auto Spa Services', 'SERVICE', [
            ('Basic Wash', 100, 250), ('Underbody Wash', 180, 399),
            ('Interior Detailing', 350, 799), ('Engine Cleaning', 320, 699),
            ('Headlight Restoration', 400, 899), ('Wax & Polish', 550, 1199),
            ('Ceramic Coating Lite', 2000, 3999), ('Vacuum Only', 60, 150)]),
    }
    AUTO_CONSUMABLES = ('Auto Consumables', [
        ('Car Shampoo 1L', 180, 299), ('Microfiber Cloth', 60, 120),
        ('Tire Shine Spray', 250, 399)])

    def _catalog(self):
        # 1. Company catalog seed files (idempotent) when present
        base = Path(__file__).resolve().parents[3]
        for fname, cmd in (('vss_services_data.txt', 'import_vss_services'),
                           ('vreal_products_data.txt', 'import_vreal_products')):
            path = base / fname
            if path.exists():
                call_command(cmd, str(path), verbosity=0)

        # 2. Per-business items for the smaller tenants
        self.business_items = {}               # slug -> [Item] sellable
        for slug, (cat_name, kind, rows) in self.EXTRA_CATALOG.items():
            category, _ = Category.objects.get_or_create(name=cat_name, kind=kind)
            items = []
            for name, cost, price in rows:
                item, _ = Item.objects.get_or_create(
                    name=name, item_type=kind,
                    defaults={
                        'category': category, 'cost_price': cost, 'selling_price': price,
                        'tracks_stock': kind == 'PRODUCT',
                        'min_stock': 10 if kind == 'PRODUCT' else 0,
                        'unit': 'pc' if kind == 'PRODUCT' else 'order',
                    },
                )
                items.append(item)
            self.business_items[slug] = items

        shampoo_cat, _ = Category.objects.get_or_create(name=self.AUTO_CONSUMABLES[0], kind='PRODUCT')
        self.consumables = []
        for name, cost, price in self.AUTO_CONSUMABLES[1]:
            item, _ = Item.objects.get_or_create(
                name=name, item_type='PRODUCT',
                defaults={'category': shampoo_cat, 'cost_price': cost,
                          'selling_price': price, 'min_stock': 10},
            )
            self.consumables.append(item)

        # 3. Sellable sets per business (exclude the other tenants' items)
        spa_items = list(Item.objects.filter(
            item_type='SERVICE').exclude(category__name__in=['Panganan Menu', 'Auto Spa Services'])
            .order_by('name')[:60])
        product_items = list(Item.objects.filter(
            item_type='PRODUCT').exclude(category__name__in=['BB Products', 'KB Items', 'Auto Consumables'])
            .order_by('name')[:40])
        self.business_items['vss'] = spa_items
        self.business_items['vreal'] = product_items
        self.business_items['autospa'] = self.business_items['autospa'] + self.consumables

        for slug, items in self.business_items.items():
            for item in items:
                BusinessItem.objects.get_or_create(
                    business=self.businesses[slug], item=item,
                    defaults={'is_available': True},
                )

        # Which item stocks which branch (products only)
        self.stock_items = {
            'vreal': product_items[:12],
            'bb': [i for i in self.business_items['bb'] if i.item_type == 'PRODUCT'],
            'autospa': self.consumables,
        }
        self.stdout.write(f'Catalog linked: {sum(len(v) for v in self.business_items.values())} sellable rows.\n')

    # ---------------------------------------------------------- operations

    ROOMS = {
        'vss': [('Room 1', 'MASSAGE'), ('Foot Spa Zone', 'FOOT_SPA'), ('VIP Suite', 'VIP')],
        'panganan': [('Table 1', 'PEDICURE'), ('Table 2', 'PEDICURE')],
        'autospa': [('Bay 1', 'PEDICURE'), ('Bay 2', 'PEDICURE')],
    }
    COMMENTS = ['Lambing ng serbisyo, babalik ako!', 'Mabilis ang proseso, salamat.',
                'Malinis at komportable.', 'Ang bait ng staff.',
                'Sulit ang bayad!', 'Maganda ang experience, 5 stars.']
    SOURCE = {'vss': 'VSS', 'vreal': 'VREAL', 'bb': 'BB'}

    def _dt(self, day, hour, minute=0):
        return timezone.make_aware(
            datetime.combine(day, time(hour, minute)), timezone.get_current_timezone())

    def _operations(self, units):
        name_i = 40
        for unit in units:
            if unit['branch'] is None:
                continue        # the branch-less business has nothing to sell
            self._unit_clients = self._seed_clients(unit, name_i)
            name_i += 4
            self._seed_rooms(unit)
            txns = self._seed_sales(unit)
            self._seed_attendance(unit)
            self._seed_feedback(unit, txns)
            self._seed_reward(unit)

    def _seed_clients(self, unit, start_i):
        clients = []
        where = unit['branch'].name if unit['branch'] else unit['business'].name
        for i in range(4):
            first, _, last = self._name(start_i + i).partition(' ')
            clients.append(ClientProfile.objects.create(
                business=unit['business'], first_name=first, last_name=last,
                age=RNG.randint(21, 58),
                gender='Female' if (start_i + i) % 2 == 0 else 'Male',
                address=f'{RNG.randint(1, 250)} Sampaguita St., {where}',
                phone_number=f'09{RNG.randint(10000000, 99999999)}',
            ))
        return clients

    def _seed_rooms(self, unit):
        plan = self.ROOMS.get(unit['business'].slug, [('Counter', 'PEDICURE')])
        rooms = [RoomTable.objects.create(
            business=unit['business'], branch=unit['branch'],
            name=name, room_type=rtype,
        ) for name, rtype in plan]
        if unit['business'].slug == 'vss' and rooms:
            busy = rooms[0]
            busy.is_occupied = True
            busy.start_time = timezone.now() - timedelta(minutes=25)
            busy.duration_minutes = 60
            busy.assigned_staff = unit['staffs'][0]
            busy.customer_name = 'Walk-in guest'
            busy.save()

    def _seed_inventory(self, unit):
        stocked = []
        for item in self.stock_items.get(unit['business'].slug, []):
            level, created = InventoryLevel.objects.get_or_create(
                branch=unit['branch'], item=item,
                defaults={'stock_qty': RNG.randint(24, 60), 'reorder_point': 10},
            )
            if created:
                StockMovement.objects.create(
                    branch=unit['branch'], item=item, quantity_delta=level.stock_qty,
                    reason='RECEIVE', reference='SEED-OPENING',
                    balance_after=level.stock_qty, created_by=unit['cashier'],
                )
            stocked.append(item)
        return stocked

    def _seed_sales(self, unit):
        biz, branch = unit['business'], unit['branch']
        items = self.business_items.get(biz.slug, [])
        staffs = [unit['cashier']] + unit['staffs']
        stocked = set(self._seed_inventory(unit))
        methods = {code: PaymentMethod.objects.get(business=biz, code=code)
                   for code in ('CASH', 'GCASH', 'MAYA', 'CARD')}
        today = timezone.localdate()
        seq, txns = 0, []
        for back in range(13, -1, -1):
            day = today - timedelta(days=back)
            shift = CashierShift.objects.create(
                business=biz, branch=branch, staff=unit['cashier'],
                status='OPEN' if back == 0 else 'CLOSED', opening_float=2000,
            )
            if back:
                CashierShift.objects.filter(pk=shift.pk).update(
                    opened_at=self._dt(day, 8), closed_at=self._dt(day, 17))
            day_total, day_exp, count = Decimal('0.00'), Decimal('0.00'), 0
            if day.day % 3 == 0:
                day_exp += Expense.objects.create(
                    business=biz, branch=branch,
                    category=RNG.choice(['UTILITIES', 'SUPPLIES', 'MAINTENANCE', 'OTHERS']),
                    description='Operating expense',
                    amount=Decimal(RNG.randint(500, 3000)), expense_date=day,
                    recorded_by=unit['manager'],
                ).amount
            for _ in range((3 + RNG.randint(0, 4)) if biz.slug == 'vss'
                           else (2 + RNG.randint(0, 3))):
                seq += 1
                txn = Transaction.objects.create(
                    business=biz, branch=branch,
                    transaction_number=f'{branch.code}-{day:%y%m%d}-{seq:03d}',
                    transaction_type='SALE', status='PAID',
                    customer=(RNG.choice(self._unit_clients)
                              if RNG.random() < 0.6 else None),
                    staff=RNG.choice(staffs),
                )
                subtotal = Decimal('0.00')
                for item in RNG.sample(items, min(len(items), RNG.randint(1, 3))):
                    qty = RNG.randint(1, 2)
                    line = Decimal(str(item.selling_price)) * qty
                    subtotal += line
                    TransactionItem.objects.create(
                        transaction=txn, branch=branch, item=item,
                        catalog_source=self.SOURCE.get(biz.slug, 'GENERIC'),
                        item_type=item.item_type, description=item.name,
                        unit_price=item.selling_price, quantity=qty, total=line,
                    )
                    if item in stocked:    # product sales draw down branch stock
                        level = InventoryLevel.objects.get(branch=branch, item=item)
                        take = min(qty, level.stock_qty)
                        if take:
                            level.stock_qty -= take
                            level.save(update_fields=['stock_qty'])
                            StockMovement.objects.create(
                                branch=branch, item=item, quantity_delta=-take,
                                reason='SALE', reference=txn.transaction_number,
                                balance_after=level.stock_qty, created_by=unit['cashier'])
                discount = ((subtotal * Decimal('0.05')).quantize(Decimal('0.01'))
                            if RNG.random() < 0.15 else Decimal('0.00'))
                total = subtotal - discount
                txn.subtotal, txn.discount, txn.total = subtotal, discount, total
                txn.amount_paid = total
                txn.customer_tier_at_purchase = (
                    txn.customer.loyalty_tier if txn.customer_id else None)
                txn.tier_discount_applied = discount
                txn.save()
                Transaction.objects.filter(pk=txn.pk).update(
                    created_at=self._dt(day, RNG.randint(9, 18), RNG.randint(0, 59)))
                roll = RNG.random()
                code = 'CASH' if roll < 0.6 else ('GCASH' if roll < 0.85 else 'CARD')
                tendered = change = None
                if code == 'CASH':
                    tendered = Decimal(math.ceil(float(total) / 20) * 20)
                    if tendered < total:
                        tendered += 20
                    change = tendered - total
                    Transaction.objects.filter(pk=txn.pk).update(change=change)
                Payment.objects.create(
                    business=biz, transaction=txn, shift=shift,
                    method=methods[code], amount=total, tendered=tendered,
                    change=change if change is not None else Decimal('0.00'),
                )
                if txn.customer_id and total >= 100:
                    pts = Decimal(int(total // 100))
                    if pts > 0:
                        client = txn.customer
                        client.loyalty_points = Decimal(str(client.loyalty_points)) + pts
                        client.total_spent = Decimal(str(client.total_spent)) + total
                        for tier in ('PLATINUM', 'GOLD', 'SILVER'):
                            if float(client.total_spent) >= client.TIER_THRESHOLDS[tier]:
                                client.loyalty_tier = tier
                                break
                        client.save(update_fields=['loyalty_points', 'total_spent',
                                                   'loyalty_tier'])
                        Transaction.objects.filter(pk=txn.pk).update(points_earned=pts)
                        LoyaltyTransaction.objects.create(
                            business=biz, customer=client, branch=branch, transaction=txn,
                            entry_type='EARN', points=pts, balance_after=client.loyalty_points,
                            reason=f'Sale {txn.transaction_number}', created_by=txn.staff)
                day_total += total
                count += 1
                txns.append(txn)
            DailySales.objects.update_or_create(
                branch=branch, date=day,
                defaults={'business': biz, 'total_sales': day_total,
                          'total_expenses': day_exp, 'transaction_count': count})
        return txns

    def _seed_attendance(self, unit):
        today = timezone.localdate()
        for person in [unit['cashier']] + unit['staffs']:
            for back in range(10):
                day = today - timedelta(days=back)
                if RNG.random() < 0.07:
                    continue                     # day off
                late = RNG.random() < 0.12
                Attendance.objects.create(
                    business=unit['business'], user=person, branch=unit['branch'],
                    date=day,
                    time_in=(self._dt(day, 8, RNG.randint(1, 15)) if late
                             else self._dt(day, 7, RNG.randint(40, 59))),
                    time_out=self._dt(day, 17, RNG.randint(0, 30)),
                    status='LATE' if late else 'PRESENT',
                )

    def _seed_feedback(self, unit, txns):
        if not txns:
            return
        for _ in range(RNG.randint(2, 3)):
            txn = RNG.choice(txns)
            CustomerFeedback.objects.create(
                business=unit['business'], branch=unit['branch'],
                customer=txn.customer, transaction=txn,
                staff=txn.staff or unit['staffs'][0],
                rating=RNG.choice([5, 5, 4, 4, 3]),
                comment=RNG.choice(self.COMMENTS),
            )

    def _seed_reward(self, unit):
        best = max(self._unit_clients, key=lambda c: c.total_spent)
        if best.total_spent <= 0:
            return
        CustomerReward.objects.create(
            customer=best, reward_type='DISCOUNT', status='AVAILABLE',
            title='10% off your next visit',
            description='Earned from your visits. Present at checkout.',
            discount_percent=Decimal('10.00'),
            expires_at=timezone.now() + timedelta(days=90),
        )
        best.free_items_available = int(best.total_spent // 5000)
        best.save(update_fields=['free_items_available'])

    # ---------------------------------------------------------- reporting

    def _write_logins_md(self, units):
        rows = []
        for ua in (UserAccess.objects.select_related('user', 'business')
                   .prefetch_related('branches')
                   .order_by('business__name', 'user__username')):
            scope = ua.business.slug if ua.business else 'ALL (company-wide)'
            names = list(ua.branches.values_list('name', flat=True))
            if names:
                scope += ' / ' + ', '.join(names)
            elif ua.business:
                scope += ' / all branches'
            rows.append(f'| {ua.user.username} | '
                        f'{self.creds.get(ua.user.username, "(unchanged)")} | '
                        f'{ua.role} | {scope} |')
        path = Path(__file__).resolve().parents[4] / 'DEMO_LOGINS.md'
        path.write_text(
            '# Demo Logins\n\n'
            'Generated by `python manage.py reseed_demo` — demo credentials '
            'only, never for production.\n\n'
            'The five `demo_*` company/primary accounts are the one-click picks '
            'on the login screen; type the others into the manual fields.\n\n'
            '| Username | Password | Role | Scope |\n'
            '|---|---|---|---|\n' + '\n'.join(rows) + '\n',
            encoding='utf-8',
        )
        self.stdout.write(f'Login sheet written to {path}\n')

    def _summary(self, units):
        counts = [
            ('Businesses', Business.objects.count()),
            ('Branches', Branch.objects.count()),
            ('Users', User.objects.count()),
            ('Access grants', UserAccess.objects.count()),
            ('Business items', BusinessItem.objects.count()),
            ('Inventory rows', InventoryLevel.objects.count()),
            ('Stock movements', StockMovement.objects.count()),
            ('Rooms', RoomTable.objects.count()),
            ('Clients', ClientProfile.objects.count()),
            ('Transactions', Transaction.objects.count()),
            ('Payments', Payment.objects.count()),
            ('Cashier shifts', CashierShift.objects.count()),
            ('Daily sales rows', DailySales.objects.count()),
            ('Attendance rows', Attendance.objects.count()),
            ('Expenses', Expense.objects.count()),
            ('Feedbacks', CustomerFeedback.objects.count()),
            ('Loyalty entries', LoyaltyTransaction.objects.count()),
        ]
        self.stdout.write(self.style.SUCCESS('\nReseed complete:'))
        for label, n in counts:
            self.stdout.write(f'  {label}: {n}')





