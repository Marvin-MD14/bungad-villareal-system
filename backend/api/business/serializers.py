# backend/api/business/serializers.py

from rest_framework import serializers
from api.business.models import BusinessType, Business


class BusinessTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = BusinessType
        fields = ['id', 'code', 'name', 'icon', 'default_unit', 'tracks_stock', 'is_active']


class BusinessSerializer(serializers.ModelSerializer):
    business_type_detail = BusinessTypeSerializer(source='business_type', read_only=True)
    branch_count = serializers.IntegerField(source='branches.count', read_only=True)
    owner_name = serializers.SerializerMethodField()

    class Meta:
        model = Business
        fields = [
            'id', 'name', 'slug', 'business_type', 'business_type_detail',
            'description', 'logo', 'receipt_header', 'currency', 'tax_rate',
            'loyalty_enabled', 'owner', 'owner_name',
            'is_active', 'branch_count', 'created_at', 'updated_at'
        ]

    def get_owner_name(self, obj):
        return obj.owner.get_full_name() or obj.owner.username if obj.owner else None
