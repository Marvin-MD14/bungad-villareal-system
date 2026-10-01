# backend/api/loyalty/serializers.py

from rest_framework import serializers

from api.loyalty.models import LoyaltyProgram, LoyaltyTransaction


class LoyaltyProgramSerializer(serializers.ModelSerializer):
    business_name = serializers.CharField(source='business.name', read_only=True)

    class Meta:
        model = LoyaltyProgram
        fields = [
            'id', 'business', 'business_name', 'earn_amount', 'redeem_value',
            'free_item_threshold', 'points_valid_days', 'is_active',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['business', 'created_at', 'updated_at']


class LoyaltyTransactionSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.full_name', read_only=True)
    entry_type_display = serializers.CharField(source='get_entry_type_display', read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    transaction_number = serializers.CharField(
        source='transaction.transaction_number', read_only=True, default=None,
    )

    class Meta:
        model = LoyaltyTransaction
        fields = [
            'id', 'business', 'customer', 'customer_name', 'branch', 'transaction',
            'transaction_number', 'entry_type', 'entry_type_display', 'points',
            'balance_after', 'reason', 'created_by', 'created_by_name', 'created_at',
        ]
        read_only_fields = fields
