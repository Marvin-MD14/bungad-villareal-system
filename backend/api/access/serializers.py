# backend/api/access/serializers.py

from rest_framework import serializers
from api.access.models import UserAccess
from api.access.staffing import RULES as STAFFING_RULES, check_staffing_change


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
        # § staffing rules (api.access.staffing): a grant change may never take
        # an outlet further from 1+ manager / exactly 1 cashier / 2+ staff.
        if role in STAFFING_RULES and business is not None:
            old_ids = self.instance.branch_ids() if self.instance is not None else None
            if 'branches' in attrs:
                branch_ids = [branch.pk for branch in attrs['branches']]
            elif self.instance is not None:
                branch_ids = old_ids
            else:
                branch_ids = []
            holder = attrs.get('user') or getattr(self.instance, 'user', None)
            check_staffing_change(
                role=role, business=business, branch_ids=branch_ids,
                is_active=is_active,
                exclude_grant_id=self.instance.pk if self.instance is not None else None,
                user_active=getattr(holder, 'is_active', True),
                old_branch_ids=old_ids,
            )
        return attrs
