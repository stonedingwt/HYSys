from datetime import datetime
from typing import List, Optional

from sqlalchemy import Column, DateTime, delete, text, update
from sqlmodel import Field, select, col

from mep.common.models.base import SQLModelSerializable
from mep.core.database import get_sync_db_session


class OrganizationBase(SQLModelSerializable):
    """Organization (company / department) – supports tree hierarchy via parent_id."""
    name: str = Field(index=True, description='Organization name')
    org_type: str = Field(default='company', index=True, description='company or department')
    parent_id: Optional[int] = Field(default=None, index=True, description='Parent org ID (null for root)')
    sort_order: int = Field(default=0, description='Sort order')
    remark: Optional[str] = Field(default=None)
    create_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, index=True, server_default=text('CURRENT_TIMESTAMP')))
    update_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')))


class Organization(OrganizationBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    __tablename__ = 'organization'


class OrganizationCreate(SQLModelSerializable):
    name: str
    org_type: str = 'company'
    parent_id: Optional[int] = None
    sort_order: int = 0
    remark: Optional[str] = None


class OrganizationUpdate(SQLModelSerializable):
    id: int
    name: Optional[str] = None
    org_type: Optional[str] = None
    parent_id: Optional[int] = None
    sort_order: Optional[int] = None
    remark: Optional[str] = None


class UserOrganization(SQLModelSerializable, table=True):
    """Link table: user <-> organization (many-to-many)."""
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(index=True, description='FK to user.user_id')
    org_id: int = Field(index=True, description='FK to organization.id')
    create_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP')))
    __tablename__ = 'user_organization'


class OrganizationDao:

    @classmethod
    def get_all(cls) -> List[Organization]:
        with get_sync_db_session() as session:
            stmt = select(Organization).order_by(Organization.sort_order, Organization.id)
            return session.exec(stmt).all()

    @classmethod
    def get_by_id(cls, org_id: int) -> Optional[Organization]:
        with get_sync_db_session() as session:
            return session.exec(select(Organization).where(Organization.id == org_id)).first()

    @classmethod
    def get_by_parent(cls, parent_id: Optional[int]) -> List[Organization]:
        with get_sync_db_session() as session:
            if parent_id is None:
                stmt = select(Organization).where(Organization.parent_id == None).order_by(Organization.sort_order)
            else:
                stmt = select(Organization).where(Organization.parent_id == parent_id).order_by(Organization.sort_order)
            return session.exec(stmt).all()

    @classmethod
    def create(cls, data: OrganizationCreate) -> Organization:
        with get_sync_db_session() as session:
            org = Organization(**data.model_dump())
            session.add(org)
            session.commit()
            session.refresh(org)
            return org

    @classmethod
    def update(cls, data: OrganizationUpdate) -> Organization:
        with get_sync_db_session() as session:
            org = session.exec(select(Organization).where(Organization.id == data.id)).first()
            if not org:
                raise ValueError(f'Organization {data.id} not found')
            update_data = data.model_dump(exclude_unset=True, exclude={'id'})
            for k, v in update_data.items():
                if v is not None:
                    setattr(org, k, v)
            org.update_time = datetime.now()
            session.add(org)
            session.commit()
            session.refresh(org)
            return org

    @classmethod
    def delete(cls, org_id: int):
        with get_sync_db_session() as session:
            session.exec(delete(UserOrganization).where(UserOrganization.org_id == org_id))
            children = session.exec(select(Organization).where(Organization.parent_id == org_id)).all()
            for child in children:
                cls.delete(child.id)
            session.exec(delete(Organization).where(Organization.id == org_id))
            session.commit()

    @classmethod
    def set_user_org(cls, user_id: int, org_id: int):
        with get_sync_db_session() as session:
            session.exec(delete(UserOrganization).where(UserOrganization.user_id == user_id))
            link = UserOrganization(user_id=user_id, org_id=org_id)
            session.add(link)
            from mep.user.domain.models.user import User
            user = session.get(User, user_id)
            if user:
                user.dept_id = str(org_id)
                session.add(user)
            session.commit()

    @classmethod
    def get_user_orgs(cls, user_id: int) -> List[Organization]:
        with get_sync_db_session() as session:
            stmt = (
                select(Organization)
                .join(UserOrganization, UserOrganization.org_id == Organization.id)
                .where(UserOrganization.user_id == user_id)
            )
            return session.exec(stmt).all()

    @classmethod
    def get_org_users(cls, org_id: int) -> List[int]:
        with get_sync_db_session() as session:
            stmt = select(UserOrganization.user_id).where(UserOrganization.org_id == org_id)
            return session.exec(stmt).all()

    @classmethod
    def get_all_user_org_map(cls) -> dict:
        """Return {user_id: [org_id, ...]}."""
        with get_sync_db_session() as session:
            links = session.exec(select(UserOrganization)).all()
            result = {}
            for link in links:
                result.setdefault(link.user_id, []).append(link.org_id)
            return result

    @classmethod
    def get_descendant_ids(cls, org_id: int) -> List[int]:
        """Return org_id itself plus all descendant org IDs."""
        all_orgs = cls.get_all()
        children_map: dict[int, list] = {}
        for o in all_orgs:
            if o.parent_id is not None:
                children_map.setdefault(o.parent_id, []).append(o.id)
        result = []
        stack = [org_id]
        while stack:
            cid = stack.pop()
            result.append(cid)
            stack.extend(children_map.get(cid, []))
        return result

    @classmethod
    def get_user_counts_by_org(cls) -> dict:
        """Return {org_id: direct_user_count} for all orgs."""
        from sqlalchemy import func as sa_func
        with get_sync_db_session() as session:
            from mep.user.domain.models.user import User
            rows = session.exec(
                select(User.dept_id, sa_func.count(User.user_id))
                .where(User.dept_id != None, User.dept_id != '')
                .group_by(User.dept_id)
            ).all()
            return {str(r[0]): r[1] for r in rows}
