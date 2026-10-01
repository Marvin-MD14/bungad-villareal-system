# backend/api/sales/services.py

from decimal import Decimal, ROUND_DOWN
from django.db import transaction as db_transaction
from django.db.models import F
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from api.models import (
    Transaction, TransactionItem, DailySales, ClientProfile,
    CustomerReward, RewardClaim, Branch
)
from api.catalog.models import Item, BusinessItem, InventoryLevel, StockMovement
from api.loyalty.models import LoyaltyProgram, LoyaltyTransaction
from api.numbering import DocumentSequence
from api.payments.models import CashierShift, Payment, PaymentMethod

# Legacy per-catalog labels, kept on TransactionItem for receipts/reports.
# The mapping itself lives on :attr:`api.models.Branch.branch_type`, which is the
# single source of truth for "which legacy catalog does this outlet belong to".
# It used to be duplicated here as an exact-match dict on the business slug, which
# silently disagreed with ``Branch.branch_type`` (substring match over slug *and*
# business type): a business slugged ``vss-spa`` or typed ``VREAL`` was labelled
# VSS/VREAL on the branch but stamped GENERIC on its receipts.

def catalog_source_for_branch(branch):
    """Map a branch's business to the legacy ``catalog_source`` enum.

    Maps to GENERIC when the outlet is MIXED (no legacy catalog matched), since
    GENERIC is the only non-VSS/VREAL/BB value the choice set allows.
    """
    branch_type = getattr(branch, 'branch_type', None)
    return branch_type if branch_type in ('VSS', 'VREAL', 'BB') else 'GENERIC'




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
    notes='',
    payments=None,
    shift=None,
):
    """Unified atomic checkout service across all businesses.

    ``payments`` is an optional list of tender specs
    (``{'method': <id or code>, 'amount': ..., 'tendered': ..., 'reference': ...}``)
    whose amounts must add up to the total; without it a single CASH tender of
    ``amount_paid`` is recorded, so every receipt always decomposes into
    ``Payment`` rows.  ``shift`` pins the sale (and its tenders) to a till
    session; when omitted the cashier's open shift at this branch is attached.
    """
    if idempotency_key:
        # all_objects: a retry must find the original receipt even if the till
        # has since switched its active business.
        existing = Transaction.all_objects.filter(idempotency_key=idempotency_key).first()
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

    # --- Payment plan ---------------------------------------------------
    # Every sale decomposes into Payment rows. With an explicit `payments`
    # list each tender must be positive, tender >= applied amount, and the
    # applied amounts must add up to the receipt total. Without one, the
    # legacy `amount_paid` becomes a single CASH tender so old clients keep
    # working unchanged.
    payment_specs = []
    if payments:
        for entry in payments:
            try:
                pay_amount = Decimal(str(entry.get('amount', '0')))
                raw_tendered = entry.get('tendered', entry.get('amount', '0'))
                pay_tendered = Decimal(str(raw_tendered if raw_tendered is not None else pay_amount))
            except (TypeError, ValueError):
                raise ValidationError('Payment amounts must be numbers.')
            if pay_amount <= 0:
                raise ValidationError('Each payment amount must be positive.')
            if pay_tendered < pay_amount:
                raise ValidationError('Tendered cannot be less than the payment amount.')
            payment_specs.append({
                'method': entry.get('method') or entry.get('method_code') or 'CASH',
                'amount': pay_amount,
                'tendered': pay_tendered,
                'reference': str(entry.get('reference', '') or '')[:100],
            })
        if sum(spec['amount'] for spec in payment_specs) != total:
            raise ValidationError('Payment amounts must add up to the transaction total.')
        tendered_total = sum((spec['tendered'] for spec in payment_specs), Decimal('0'))
    else:
        if amount_paid > 0 and total > 0:
            payment_specs = [{
                'method': 'CASH', 'amount': total, 'tendered': amount_paid, 'reference': '',
            }]
        tendered_total = amount_paid
    if tendered_total < total:
        raise ValidationError('Payment is less than the transaction total.')
    change_total = tendered_total - total

    # --- Loyalty earning rules (per-business config, not hardcoded) ------
    program = LoyaltyProgram.for_business(branch.business)
    loyalty_active = (
        customer is not None
        and branch.business.loyalty_enabled
        and program.is_active
        and program.earn_amount > 0
    )
    points_earned = (
        (total / program.earn_amount).quantize(Decimal('0.01'), rounding=ROUND_DOWN)
        if loyalty_active else Decimal('0')
    )

    # --- Numbering -------------------------------------------------------
    # Counter-derived (TXN-YYYYMMDD-0042), locked per business: the old
    # date + random hex scheme collided across concurrent tills.
    txn_number = DocumentSequence.next_document_number(branch.business, prefix='TXN')
    shift_obj = shift or CashierShift.objects.filter(
        branch=branch, staff=cashier, status='OPEN',
    ).first()
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
        amount_paid=tendered_total,
        change=change_total,
        status='PAID',
        notes=notes,
        shift=shift_obj,
        customer_tier_at_purchase=tier_at_purchase,
        tier_discount_applied=tier_discount_amount,
        points_earned=points_earned,
    )

    # --- Tenders ----------------------------------------------------------
    if payment_specs:
        PaymentMethod.ensure_defaults(branch.business)
        for spec in payment_specs:
            method = PaymentMethod.resolve(branch.business, spec['method'])
            if method is None:
                raise ValidationError(
                    f'Unknown payment method: {spec["method"]}. '
                    'Create it under /payment-methods/ first.'
                )
            Payment.objects.create(
                business=branch.business,
                transaction=txn,
                shift=shift_obj,
                method=method,
                amount=spec['amount'],
                tendered=spec['tendered'],
                change=max(Decimal('0'), spec['tendered'] - spec['amount']),
                reference=spec['reference'],
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
            branch=branch,
            item=item_obj,
            item_type=item_obj.item_type,
            catalog_source=catalog_source_for_branch(branch),
            description=item_obj.name,
            unit_price=pi['price'],
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
    # F() expressions, not read-modify-write: two tills selling into the same
    # daily row at the same time both land instead of the later read clobbering
    # the earlier write.
    DailySales.objects.filter(pk=daily_sales.pk).update(
        total_sales=F('total_sales') + total,
        transaction_count=F('transaction_count') + 1,
        updated_at=timezone.now(),
    )

    if customer:
        old_tier = customer.loyalty_tier
        free_items_earned = (
            int(total // program.free_item_threshold)
            if loyalty_active and program.free_item_threshold > 0
            else 0
        )
        # Same story as the daily row: balances move with guarded F() updates.
        ClientProfile.objects.filter(pk=customer.pk).update(
            total_spent=F('total_spent') + total,
            loyalty_points=F('loyalty_points') + points_earned,
            free_items_available=F('free_items_available') + free_items_earned,
            updated_at=timezone.now(),
        )
        customer.refresh_from_db()
        if points_earned:
            # The ledger row is the source of truth; the cached column above is
            # what this entry sums to. A balance can now always be replayed.
            LoyaltyTransaction.objects.create(
                business=branch.business,
                customer=customer,
                branch=branch,
                transaction=txn,
                entry_type='EARN',
                points=points_earned,
                balance_after=customer.loyalty_points,
                reason=f'Earned on {txn_number}',
                created_by=cashier,
            )

        customer.recalculate_tier()
        customer.save(update_fields=['loyalty_tier', 'updated_at'])

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

    # Daily ledger: move the amount from sales into voids for that day,
    # with F() so a concurrent sale hitting the same row is not clobbered.
    DailySales.objects.filter(
        branch=transaction.branch, date=transaction.created_at.date(),
    ).update(
        total_void=F('total_void') + transaction.total,
        total_sales=F('total_sales') - transaction.total,
        updated_at=timezone.now(),
    )

    # Reverse the points the sale earned — as a *new* ledger entry. The
    # original EARN row stays, so the audit trail shows both sides.
    customer = transaction.customer
    if customer and transaction.points_earned:
        reversal = -Decimal(str(transaction.points_earned))
        ClientProfile.objects.filter(pk=customer.pk).update(
            loyalty_points=F('loyalty_points') + reversal,
            updated_at=timezone.now(),
        )
        customer.refresh_from_db()
        LoyaltyTransaction.objects.create(
            business=transaction.business,
            customer=customer,
            branch=transaction.branch,
            transaction=transaction,
            entry_type='ADJUST',
            points=reversal,
            balance_after=customer.loyalty_points,
            reason=f'Void of {transaction.transaction_number}',
            created_by=staff,
        )

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
def transfer_stock(*, from_branch, to_branch, item, quantity, reference='', user=None):
    """Move stock between two branches of the same business, atomically.

    Both sides are written to the ledger (``TRANSFER_OUT`` then ``TRANSFER_IN``)
    so the audit trail always balances out.  The source is decremented with a
    guarded UPDATE, so two concurrent transfers can never oversell the same row.
    """
    if quantity <= 0:
        raise ValidationError('Quantity must be positive.')
    if from_branch.pk == to_branch.pk:
        raise ValidationError('Source and destination branch must differ.')
    if from_branch.business_id != to_branch.business_id:
        raise ValidationError('Stock can only be transferred within one business.')

    source = InventoryLevel.objects.filter(branch=from_branch, item=item).first()
    if source is None or source.stock_qty < quantity:
        raise ValidationError(
            f'Insufficient stock for {item.name} at {from_branch.name} '
            f'(have {source.stock_qty if source else 0}, need {quantity}).'
        )

    moved = InventoryLevel.objects.filter(
        pk=source.pk, stock_qty__gte=quantity
    ).update(stock_qty=F('stock_qty') - quantity)
    if not moved:
        raise ValidationError(f'Insufficient stock for {item.name} at {from_branch.name}.')
    source.refresh_from_db()

    reference = reference or f'TR-{from_branch.pk}to{to_branch.pk}'
    StockMovement.objects.create(
        branch=from_branch,
        item=item,
        quantity_delta=-quantity,
        reason='TRANSFER_OUT',
        reference=reference,
        balance_after=source.stock_qty,
        created_by=user,
    )

    destination, _ = InventoryLevel.objects.get_or_create(
        branch=to_branch,
        item=item,
        defaults={'stock_qty': 0},
    )
    InventoryLevel.objects.filter(pk=destination.pk).update(stock_qty=F('stock_qty') + quantity)
    destination.refresh_from_db()
    StockMovement.objects.create(
        branch=to_branch,
        item=item,
        quantity_delta=quantity,
        reason='TRANSFER_IN',
        reference=reference,
        balance_after=destination.stock_qty,
        created_by=user,
    )
    return destination


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

