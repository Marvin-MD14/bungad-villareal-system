# backend/api/access/serializers.py

from rest_framework import serializers
from api.access.models import UserAccess


class UserAccessSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    business_name = serializers.CharField(source='business.name', read_only=True)

    class Meta:
        model = UserAccess
        fields = [
            'id', 'user', 'username', 'role', 'business', 'business_name',
            'branches', 'is_primary', 'is_active', 'created_at'
        ]
