"""Unified permission context for assistant query tools.

Resolves user roles, customer bindings, and data-access scope so that every
query tool can apply consistent permission filtering.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import List

from mep.database.constants import AdminRole

logger = logging.getLogger(__name__)

ELEVATED_ROLE_IDS = {AdminRole, 5}


@dataclass
class PermissionContext:
    user_id: int
    user_name: str = ''
    role_ids: List[int] = field(default_factory=list)
    is_admin: bool = False
    is_elevated: bool = False
    accessible_customers: List[str] = field(default_factory=list)

    @property
    def has_full_access(self) -> bool:
        return self.is_admin or self.is_elevated

    def can_access_customer(self, customer_name: str) -> bool:
        if self.has_full_access:
            return True
        return customer_name in self.accessible_customers

    def customer_filter_list(self) -> List[str] | None:
        """Return customer names for SQL IN-clause filtering.

        Returns ``None`` when the user has full access (no filtering needed).
        """
        if self.has_full_access:
            return None
        return self.accessible_customers


async def resolve_permission_context(user_id: int, user_name: str = '') -> PermissionContext:
    """Build a :class:`PermissionContext` by querying roles and customer bindings."""
    from mep.user.domain.models.user_role import UserRoleDao
    from mep.database.models.master_data import MasterDataDao

    roles = await UserRoleDao.aget_user_roles(user_id)
    role_ids = [r.role_id for r in roles]

    is_admin = AdminRole in role_ids
    is_elevated = bool(set(role_ids) & ELEVATED_ROLE_IDS)

    if is_elevated:
        accessible = await MasterDataDao.get_all_customer_names()
    else:
        accessible = await MasterDataDao.get_customer_names_for_user(user_id)

    return PermissionContext(
        user_id=user_id,
        user_name=user_name,
        role_ids=role_ids,
        is_admin=is_admin,
        is_elevated=is_elevated,
        accessible_customers=accessible,
    )


def resolve_permission_context_sync(user_id: int, user_name: str = '') -> PermissionContext:
    """Synchronous version for use inside LangChain tool ``_run``."""
    from mep.user.domain.models.user_role import UserRoleDao
    from mep.database.models.master_data import MasterDataDao

    roles = UserRoleDao.get_user_roles(user_id)
    role_ids = [r.role_id for r in roles]

    is_admin = AdminRole in role_ids
    is_elevated = bool(set(role_ids) & ELEVATED_ROLE_IDS)

    if is_elevated:
        from mep.core.database import get_sync_db_session
        from sqlmodel import text as sql_text
        with get_sync_db_session() as session:
            rows = session.execute(sql_text("SELECT customer_name FROM master_customer ORDER BY customer_name")).fetchall()
            accessible = [r[0] for r in rows if r[0]]
    else:
        accessible = MasterDataDao.get_customer_names_for_user_sync(user_id)

    return PermissionContext(
        user_id=user_id,
        user_name=user_name,
        role_ids=role_ids,
        is_admin=is_admin,
        is_elevated=is_elevated,
        accessible_customers=accessible,
    )
