from typing import List, Optional

from fastapi import APIRouter, Body, Depends

from mep.api.v1.schemas import resp_200
from mep.common.dependencies.user_deps import UserPayload
from mep.database.models.organization import (
    Organization, OrganizationCreate, OrganizationUpdate,
    OrganizationDao, UserOrganization,
)

router = APIRouter(prefix='/org', tags=['Organization'], dependencies=[Depends(UserPayload.get_login_user)])


@router.get('/list')
async def list_organizations(login_user: UserPayload = Depends(UserPayload.get_login_user)):
    """Get all organizations (flat list)."""
    orgs = OrganizationDao.get_all()
    return resp_200([org.model_dump() for org in orgs])


@router.get('/tree')
async def get_organization_tree(login_user: UserPayload = Depends(UserPayload.get_login_user)):
    """Get organizations as a tree structure."""
    all_orgs = OrganizationDao.get_all()
    org_map = {org.id: {**org.model_dump(), 'children': []} for org in all_orgs}
    roots = []
    for org in all_orgs:
        node = org_map[org.id]
        if org.parent_id and org.parent_id in org_map:
            org_map[org.parent_id]['children'].append(node)
        else:
            roots.append(node)
    return resp_200(roots)


@router.post('/create')
async def create_organization(
    data: OrganizationCreate,
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    """Create a new organization (company or department)."""
    org = OrganizationDao.create(data)
    return resp_200(org.model_dump())


@router.put('/update')
async def update_organization(
    data: OrganizationUpdate,
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    """Update organization."""
    org = OrganizationDao.update(data)
    return resp_200(org.model_dump())


@router.delete('/delete')
async def delete_organization(
    org_id: int,
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    """Delete organization and its children."""
    OrganizationDao.delete(org_id)
    return resp_200()


@router.post('/set_user_org')
async def set_user_organization(
    user_id: int = Body(..., embed=True),
    org_id: int = Body(..., embed=True),
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    """Assign user to an organization."""
    OrganizationDao.set_user_org(user_id, org_id)
    return resp_200()


@router.get('/user_orgs')
async def get_user_organizations(
    user_id: int,
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    """Get organizations a user belongs to."""
    orgs = OrganizationDao.get_user_orgs(user_id)
    return resp_200([org.model_dump() for org in orgs])


@router.get('/org_users')
async def get_organization_users(
    org_id: int,
    login_user: UserPayload = Depends(UserPayload.get_login_user),
):
    """Get user IDs in an organization."""
    user_ids = OrganizationDao.get_org_users(org_id)
    return resp_200(user_ids)
