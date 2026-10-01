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

    def validate(self, attrs):
        """Give a friendly 400 where the ``single_active_owner`` index would 500.

        The constraint is the guarantee; this is the explanation. Existing
        owner means the *other* grant — deactivate or change it first.
        """
        role = attrs.get('role', getattr(self.instance, 'role', None))
        business = attrs.get('business', getattr(self.instance, 'business', None))
        is_active = attrs.get('is_active', getattr(self.instance, 'is_active', True))
        if role == 'OWNER' and business is None and is_active:
            existing = UserAccess.objects.filter(
                role='OWNER', business__isnull=True, is_active=True,
            ).exclude(pk=getattr(self.instance, 'pk', None))
            if existing.exists():
                raise serializers.ValidationError(
                    {'role': 'There is already an active OWNER. Deactivate or '
                             'change the existing owner grant first.'}
                )
        return attrs
