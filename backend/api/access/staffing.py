# backend/api/access/staffing.py
"""Branch staffing rules — the outlet-composition policy.

Every staffed unit — an outlet, or a branch-less business treated as one
unit — must satisfy, counting ACTIVE grants that COVER it (a grant covers a
unit when it ticks the branch or ticks no branch at all, i.e. business-wide):

* Business Manager — at least 1  (the successor of the retired BRANCH_ADMIN;
  a business-wide manager covers every outlet of the business)
* Cashier          — exactly 1   (one till, one cashier)
* Staff            — at least 2  (more than one pair of hands)

Enforcement is a ratchet: a write may never *increase* a unit's distance
from conformance.  Staffing a fresh outlet therefore works step by step
(0 cashiers -> 1 strictly improves and is allowed), while cloning or moving
the last cashier of a staffed outlet answers 400 and names the outlet.
GET /api/branches/conformance/ reports every unit that is currently short.
"""

from django.db.models import Q
from rest_framework import serializers

from api.access.models import UserAccess

# role -> (kind, target); kind 'min' = at least, 'exact' = exactly
RULES = {
    'BUSINESS_MANAGER': ('min', 1),
    'CASHIER': ('exact', 1),
    'STAFF': ('min', 2),
}

RULE_TEXT = {
    'BUSINESS_MANAGER': 'needs at least 1 Business Manager',
    'CASHIER': 'must have exactly 1 Cashier',
    'STAFF': 'needs at least 2 Staff',
}


def _distance(role, count):
    """How far ``count`` is from what ``role`` requires (0 == conforming)."""
    kind, target = RULES[role]
    if kind == 'min':
        return max(0, target - count)
    return abs(target - count)


def _covering_grants(business, branch, exclude_id=None, exclude_user_id=None):
    """Active staffing-role grants whose holder works at ``branch`` (None = the
    branch-less business itself).  Same coverage semantics as
    :func:`api.access.models.branch_staff_grants`, so counts here match
    ``GET /api/branches/{id}/staffing/``."""
    qs = UserAccess.objects.filter(
        business=business, is_active=True,
        role__in=RULES, user__is_active=True,
    )
    if branch is not None:
        qs = qs.filter(Q(branches=branch) | Q(branches__isnull=True))
    if exclude_id is not None:
        qs = qs.exclude(pk=exclude_id)
    if exclude_user_id is not None:
        qs = qs.exclude(user_id=exclude_user_id)
    return qs


def counts_for(business, branch=None, exclude_id=None, exclude_user_id=None):
    """Distinct active users per staffing role covering the unit."""
    users = {role: set() for role in RULES}
    for role, user_id in _covering_grants(
        business, branch, exclude_id=exclude_id, exclude_user_id=exclude_user_id
    ).values_list('role', 'user_id'):
        users[role].add(user_id)
    return {role: len(ids) for role, ids in users.items()}


def staffing_units(business):
    """The branches to police — or the business itself when it has none."""
    from api.models import Branch  # local import: app-loading order
    branches = list(Branch.all_objects.filter(business=business, is_active=True))
    return branches or [None]


def _unit_label(business, branch):
    return branch.name if branch is not None else f'{business.name} (branch-less)'


def _message(business, branch, role, before, after):
    return (f'{_unit_label(business, branch)} {RULE_TEXT[role]} — this change '
            f'would leave {after} (currently {before}).')


def check_staffing_change(*, role, business, branch_ids=None, is_active=True,
                          exclude_grant_id=None, user_active=True,
                          old_branch_ids=None):
    """400 when a grant create/update/replace takes any unit further from
    conformance.  ``branch_ids`` = branches the resulting grant ticks (empty =
    business-wide); ``old_branch_ids`` = branches the replaced row ticked, so
    a *move* is judged on what it un-covers too; ``exclude_grant_id`` = row
    being replaced."""
    if role not in RULES or business is None:
        return
    from api.models import Branch  # local import: app-loading order

    def _units(ids):
        if ids:
            return list(Branch.all_objects.filter(pk__in=list(ids), is_active=True))
        return staffing_units(business)

    new_ids = list(branch_ids or [])
    covers_all = not new_ids
    units = _units(new_ids)
    if old_branch_ids is not None:
        # Judge the branches the old row covered (empty = business-wide).
        seen = {u.pk if u is not None else None for u in units}
        for unit in _units(old_branch_ids):
            if unit.pk not in seen:
                units.append(unit)
    adding = bool(is_active and user_active)
    problems = []
    for branch in units:
        before = counts_for(business, branch)
        after = counts_for(business, branch, exclude_id=exclude_grant_id)
        if adding and (covers_all or branch.pk in new_ids):
            after[role] += 1
        for rule_role, count in after.items():
            if _distance(rule_role, count) > _distance(rule_role, before[rule_role]):
                problems.append(_message(business, branch, rule_role, before[rule_role], count))
    if problems:
        raise serializers.ValidationError({'detail': ' '.join(problems)})


def check_user_deactivation(user):
    """400 when switching a user off would strip a unit of required cover.

    The staffing counts follow ``user.is_active``, so deactivating the last
    covering cashier is a staffing change — it must fail the same ratchet.
    """
    from api.models import Branch  # local import: app-loading order
    problems = []
    checked = set()
    grants = (UserAccess.objects
              .filter(user=user, is_active=True, role__in=RULES)
              .exclude(business__isnull=True)
              .select_related('business'))
    for access in grants:
        ticked = access.branch_ids()
        units = (list(Branch.all_objects.filter(pk__in=ticked)) if ticked
                 else staffing_units(access.business))
        for branch in units:
            key = (access.business_id, branch.pk if branch is not None else None)
            if key in checked:
                continue
            checked.add(key)
            before = counts_for(access.business, branch)
            after = counts_for(access.business, branch, exclude_user_id=user.pk)
            for role, count in after.items():
                if _distance(role, count) > _distance(role, before[role]):
                    problems.append(_message(access.business, branch, role, before[role], count))
    if problems:
        raise serializers.ValidationError({'detail': ' '.join(problems)})


def unit_state(business, branch):
    """Conformance snapshot of one unit for the violations report."""
    counts = counts_for(business, branch)
    violations = [f'{_unit_label(business, branch)} {RULE_TEXT[role]} — currently {n}'
                  for role, n in counts.items() if _distance(role, n)]
    return {
        'business': business.name,
        'business_id': business.pk,
        'branch': branch.name if branch is not None else '(branch-less)',
        'branch_id': branch.pk if branch is not None else None,
        'counts': counts,
        'violations': violations,
        'conformed': not violations,
    }


def conformance_payload(businesses):
    results = [unit_state(business, branch)
               for business in businesses for branch in staffing_units(business)]
    violating = sum(1 for row in results if not row['conformed'])
    return {
        'summary': {
            'units_total': len(results),
            'conformed': len(results) - violating,
            'violating': violating,
        },
        'results': results,
    }

