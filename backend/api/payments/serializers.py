# backend/api/payments/serializers.py

from rest_framework import serializers

from api.payments.models import CashierShift, Payment, PaymentMethod


class PaymentMethodSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentMethod
        fields = ['id', 'business', 'code', 'name', 'is_active', 'created_at']
        read_only_fields = ['business', 'created_at']


class PaymentSerializer(serializers.ModelSerializer):
    method_name = serializers.CharField(source='method.name', read_only=True)
    method_code = serializers.CharField(source='method.code', read_only=True)
    transaction_number = serializers.CharField(
        source='transaction.transaction_number', read_only=True,
    )

    class Meta:
        model = Payment
        fields = [
            'id', 'transaction', 'transaction_number', 'shift', 'method',
            'method_name', 'method_code', 'amount', 'tendered', 'change',
            'reference', 'created_at',
        ]
        read_only_fields = fields


class CashierShiftSerializer(serializers.ModelSerializer):
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    staff_name = serializers.CharField(source='staff.username', read_only=True)

    class Meta:
        model = CashierShift
        fields = [
            'id', 'business', 'branch', 'branch_name', 'staff', 'staff_name',
            'status', 'opening_float', 'opened_at', 'closed_at', 'closing_cash',
            'expected_cash', 'over_short', 'notes',
        ]
        read_only_fields = [
            'business', 'staff', 'status', 'opened_at', 'closed_at',
            'closing_cash', 'expected_cash', 'over_short',
        ]
