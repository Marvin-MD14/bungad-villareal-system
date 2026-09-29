# backend/api/sales/services.py

from decimal import Decimal
from uuid import uuid4
from django.db import transaction as db_transaction
from django.db.models import F
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from api.models import (
    Transaction, TransactionItem, DailySales, ClientProfile,
    CustomerReward, RewardClaim, Branch
)
from api.catalog.models import Item, BusinessItem, InventoryLevel, StockMovement

# Legacy per-catalog labels, kept on TransactionItem for receipts/reports.
_CATALOG_BY_BUSINESS = {'vss': 'VSS', 'vreal': 'VREAL', 'bb': 'BB'}
_CATALOG_BY_BRANCH_TYPE = {'VSS': 'VSS', 'VREAL': 'VREAL', 'BB': 'BB'}


def catalog_source_for_branch(branch):
    """Map a branch (or its business) to the legacy catalog_source enum."""
    if branch.business_id and branch.business:
        return _CATALOG_BY_BUSINESS.get(branch.business.slug, 'GENERIC')
    return _CATALOG_BY_BRANCH_TYPE.get(getattr(branch, 'branch_type', ''), 'GENERIC')


@db_transaction.atomic
def checkout(
    *,
    branch,
    cashier,
    items,
    customer=None,
    amount_paid=Decimal('0'),
    discount=Decimal('0'),
    reward_ids=(),
    apply_tier_discount=True,
    idempotency_key=None,
    notes=''
):
    """Unified atomic checkout service across all businesses."""
    if idempotency_key:
        existing = Transaction.objects.filter(idempotency_key=idempotency_key).first()
        if existing:
            return existing

    if not items:
        raise ValidationError('At least one item is required.')
    if discount < 0 or amount_paid < 0:
        raise ValidationError('Discount and payment cannot be negative.')

    prepared_items = []
    subtotal = Decimal('0')

    for line in items:
        item_id = line.get('item') or line.get('item_id')
        qty = int(line.get('quantity', 0))
        if qty < 1:
            raise ValidationError('Quantity must be at least 1.')

        entry = BusinessItem.objects.select_related('item').filter(
            business=branch.business,
            item_id=item_id,
            is_available=True
        ).first()

        if not entry:
            direct_item = Item.objects.filter(pk=item_id, is_active=True).first()
            if not direct_item:
                raise ValidationError(f'Item {item_id} is not available for this business.')
            price = direct_item.selling_price
            item_obj = direct_item
        else:
            price = entry.effective_price
            item_obj = entry.item

        if item_obj.tracks_stock:
            updated = InventoryLevel.objects.filter(
                branch=branch,
                item=item_obj,
                stock_qty__gte=qty
            ).update(stock_qty=F('stock_qty') - qty)

            if not updated:
                raise ValidationError(f'Insufficient stock for {item_obj.name}.')

        line_total = price * qty
        subtotal += line_total
        prepared_items.append({
            'item': item_obj,
            'price': price,
            'quantity': qty,
            'total': line_total,
        })

    tier_discount_amount = Decimal('0')
    tier_at_purchase = None
    if customer and apply_tier_discount:
        tier_at_purchase = customer.loyalty_tier
        discount_rate = Decimal(str(customer.get_discount_rate())) / Decimal('100')
        tier_discount_amount = (subtotal * discount_rate).quantize(Decimal('0.01'))

    reward_discount = Decimal('0')
    claimed_rewards = []
    if reward_ids and customer:
        for rid in reward_ids:
            try:
                r = CustomerReward.objects.select_for_update().get(pk=rid, customer=customer, status='AVAILABLE')
                if r.reward_type == 'DISCOUNT':
                    if r.discount_percent > 0:
                        reward_discount += (subtotal * (r.discount_percent / Decimal('100'))).quantize(Decimal('0.01'))
                    else:
                        reward_discount += r.value
                r.status = 'CLAIMED'
                r.claimed_at = timezone.now()
                r.save()
                claimed_rewards.append(r)
            except CustomerReward.DoesNotExist:
                pass

    total_discount = discount + tier_discount_amount + reward_discount
    total = max(Decimal('0'), subtotal - total_discount)

    if amount_paid < total:
        raise ValidationError('Payment is less than the transaction total.')

    points_earned = (total / Decimal('100')).quantize(Decimal('0.01')) if customer else Decimal('0')

    txn_number = f"TXN-{timezone.now():%Y%m%d}-{uuid4().hex[:8].upper()}"
    txn = Transaction.objects.create(
        idempotency_key=idempotency_key,
        business=branch.business,
        branch=branch,
        transaction_number=txn_number,
        transaction_type='SALE',
        customer=customer,
        staff=cashier,
        subtotal=subtotal,
        discount=total_discount,
        total=total,
        amount_paid=amount_paid,
        change=amount_paid - total,
        status='PAID',
        notes=notes,
        customer_tier_at_purchase=tier_at_purchase,
        tier_discount_applied=tier_discount_amount,
        points_earned=points_earned,
    )

    for r in claimed_rewards:
        r.claimed_in_transaction = txn
        r.save()
        txn.rewards_applied.add(r)
        RewardClaim.objects.create(
            reward=r,
            transaction=txn,
            claimed_by=cashier,
            amount_applied=r.value,
        )

    for pi in prepared_items:
        item_obj = pi['item']
        TransactionItem.objects.create(
            transaction=txn,
            item=item_obj,
            item_type=item_obj.item_type,
            catalog_source=catalog_source_for_branch(branch),
            description=item_obj.name,
            price=pi['price'],
            quantity=pi['quantity'],
            total=pi['total'],
        )

        if item_obj.tracks_stock:
            curr_inv = InventoryLevel.objects.get(branch=branch, item=item_obj)
            StockMovement.objects.create(
                branch=branch,
                item=item_obj,
                quantity_delta=-pi['quantity'],
                reason='SALE',
                reference=txn_number,
                balance_after=curr_inv.stock_qty,
                created_by=cashier,
            )

    daily_sales, _ = DailySales.objects.get_or_create(
        business=branch.business,
        branch=branch,
        date=timezone.localdate()
    )
    daily_sales.total_sales = Decimal(str(daily_sales.total_sales or 0)) + total
    daily_sales.transaction_count += 1
    daily_sales.save(update_fields=['total_sales', 'transaction_count', 'updated_at'])

    if customer:
        old_tier = customer.loyalty_tier
        customer.total_spent = Decimal(str(customer.total_spent or 0)) + total
        customer.loyalty_points = Decimal(str(customer.loyalty_points or 0)) + points_earned
        free_items_earned = int(total // Decimal('5000'))
        if free_items_earned > 0:
            customer.free_items_available += free_items_earned

        customer.recalculate_tier()
        customer.save()

        if old_tier != customer.loyalty_tier:
            CustomerReward.objects.create(
                customer=customer,
                reward_type='TIER_UPGRADE',
                title=f"🎉 Welcome to {customer.get_loyalty_tier_display()}!",
                description=f"You've been upgraded to {customer.get_loyalty_tier_display()}.",
                value=Decimal('0'),
                discount_percent=Decimal(str(customer.get_discount_rate())),
                transaction=txn,
            )

    return txn

@db_transaction.atomic
def void_sale(*, transaction, staff, reason=''):
    """Atomic void service: restores stock, updates the daily ledger, logs movements."""
    if transaction.transaction_type == 'VOID':
        raise ValidationError('Transaction is already voided.')

    transaction.transaction_type = 'VOID'
    transaction.status = 'VOIDED'
    transaction.notes = f"{transaction.notes or ''}\n[VOIDED] {reason}".strip()
    transaction.save(update_fields=['transaction_type', 'status', 'notes'])

    for ti in transaction.items.all():
        if ti.item and ti.item.tracks_stock:
            InventoryLevel.objects.filter(branch=transaction.branch, item=ti.item).update(
                stock_qty=F('stock_qty') + ti.quantity
            )
            curr_inv = InventoryLevel.objects.get(branch=transaction.branch, item=ti.item)
            StockMovement.objects.create(
                branch=transaction.branch,
                item=ti.item,
                quantity_delta=ti.quantity,
                reason='VOID',
                reference=transaction.transaction_number,
                balance_after=curr_inv.stock_qty,
                created_by=staff,
            )

    # Daily ledger: move the amount from sales into voids for that day.
    try:
        daily = DailySales.objects.get(
            branch=transaction.branch, date=transaction.created_at.date()
        )
        daily.total_void = Decimal(str(daily.total_void or 0)) + transaction.total
        daily.total_sales = Decimal(str(daily.total_sales or 0)) - transaction.total
        daily.save(update_fields=['total_void', 'total_sales', 'updated_at'])
    except DailySales.DoesNotExist:
        pass

    return transaction


@db_transaction.atomic
def receive_stock(*, branch, item, quantity, reference='', user=None):
    """Receive incoming stock at a branch with atomic ledger entry."""
    if quantity <= 0:
        raise ValidationError('Quantity received must be positive.')

    inv, _ = InventoryLevel.objects.get_or_create(
        branch=branch,
        item=item,
        defaults={'stock_qty': 0}
    )
    InventoryLevel.objects.filter(pk=inv.pk).update(stock_qty=F('stock_qty') + quantity)
    inv.refresh_from_db()

    StockMovement.objects.create(
        branch=branch,
        item=item,
        quantity_delta=quantity,
        reason='RECEIVE',
        reference=reference,
        balance_after=inv.stock_qty,
        created_by=user,
    )
    return inv


@db_transaction.atomic
def adjust_stock(*, branch, item, new_quantity, reason='ADJUST', reference='', user=None):
    """Manually adjust stock balance with delta tracking in ledger."""
    if new_quantity < 0:
        raise ValidationError('Stock quantity cannot be negative.')

    inv, _ = InventoryLevel.objects.get_or_create(
        branch=branch,
        item=item,
        defaults={'stock_qty': 0}
    )
    delta = new_quantity - inv.stock_qty
    inv.stock_qty = new_quantity
    inv.save(update_fields=['stock_qty', 'updated_at'])

    StockMovement.objects.create(
        branch=branch,
        item=item,
        quantity_delta=delta,
        reason=reason,
        reference=reference,
        balance_after=new_quantity,
        created_by=user,
    )
    return inv

