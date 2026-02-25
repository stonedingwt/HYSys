"""
Flow Model Module
元境应用流程模型模块
"""
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Tuple, Union, Any

from pydantic import field_validator
from sqlalchemy import Column, DateTime, String, and_, func, or_, text
from sqlmodel import JSON, Field, select, update, col

from mep.common.constants.enums.telemetry import BaseTelemetryTypeEnum, ApplicationTypeEnum
from mep.common.models.base import SQLModelSerializable
from mep.common.schemas.telemetry.event_data_schema import NewApplicationEventData
from mep.common.services import telemetry_service
from mep.core.database import get_sync_db_session, get_async_db_session
from mep.core.logger import trace_id_var
from mep.database.models.assistant import Assistant
from mep.database.models.role_access import AccessType, RoleAccess, RoleAccessDao
from mep.user.domain.models.user_role import UserRoleDao
from mep.utils import generate_uuid


class FlowStatusEnum(Enum):
    """流程状态枚举"""
    OFFLINE = 1
    ONLINE = 2


class FlowTypeEnum(Enum):
    """流程类型枚举"""
    FLOW = 1
    ASSISTANT = 5
    WORKFLOW = 10
    WORKSTATION = 15
    LINSIGHT = 20


class AppTypeEnum(Enum):
    """应用类型枚举"""
    Flow = 'flow'
    ASSISTANT = 'assistant'
    WORKFLOW = 'workflow'


class UserLinkTypeEnum(Enum):
    """用户链接类型枚举"""
    app = AppTypeEnum


class FlowEntityBase(SQLModelSerializable):
    """流程实体基类"""
    name: str = Field(index=True)
    user_id: Optional[int] = Field(default=None, index=True)
    description: Optional[str] = Field(default=None, sa_column=Column(String(length=1000)))
    data: Optional[Dict] = Field(default=None)
    logo: Optional[str] = Field(default=None, index=False)
    status: Optional[int] = Field(index=False, default=1)
    flow_type: Optional[int] = Field(index=False, default=1)
    guide_word: Optional[str] = Field(default=None, sa_column=Column(String(length=1000)))
    create_time: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime, nullable=False, index=True, server_default=text('CURRENT_TIMESTAMP'))
    )
    update_time: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'))
    )

    @field_validator('data', mode='before')
    @classmethod
    def validate_data_structure(cls, value):
        """验证数据结构"""
        if not value:
            return value
        if not isinstance(value, dict):
            raise ValueError('Flow must be a valid JSON')
        if 'nodes' not in value.keys():
            raise ValueError('Flow must have nodes')
        if 'edges' not in value.keys():
            raise ValueError('Flow must have edges')
        return value


class Flow(FlowEntityBase, table=True):
    """流程实体类"""
    id: str = Field(default_factory=generate_uuid, primary_key=True, unique=True)
    data: Optional[Dict] = Field(default=None, sa_column=Column(JSON))


class FlowCreateModel(FlowEntityBase):
    """流程创建模型"""
    flow_id: Optional[str] = None


class FlowReadModel(FlowEntityBase):
    """流程读取模型"""
    id: str
    user_name: Optional[str] = None
    version_id: Optional[int] = None


class FlowReadWithStyleModel(FlowReadModel):
    """流程读取模型（含样式）"""
    total: Optional[int] = None


class FlowUpdateModel(SQLModelSerializable):
    """流程更新模型"""
    name: Optional[str] = None
    logo: Optional[str] = None
    description: Optional[str] = None
    data: Optional[Dict] = None
    status: Optional[int] = None
    guide_word: Optional[str] = None


class FlowQueryBuilder:
    """流程查询构建器"""
    
    @staticmethod
    def build_base_query() -> select:
        """构建基础查询"""
        return select(
            Flow.id, Flow.user_id, Flow.name, Flow.status, Flow.create_time,
            Flow.logo, Flow.update_time, Flow.description, Flow.guide_word, Flow.flow_type
        )
    
    @staticmethod
    def build_union_query() -> select:
        """构建联合查询"""
        return select(
            Flow.id, Flow.name, Flow.description, Flow.flow_type, Flow.logo, Flow.user_id,
            Flow.status, Flow.create_time, Flow.update_time
        ).union_all(
            select(
                Assistant.id, Assistant.name, Assistant.desc, FlowTypeEnum.ASSISTANT.value,
                Assistant.logo, Assistant.user_id, Assistant.status, Assistant.create_time,
                Assistant.update_time
            ).where(Assistant.is_delete == 0)
        ).subquery()


class FlowRepository:
    """流程数据访问层"""
    
    @classmethod
    def save(cls, flow_entity: Flow) -> Flow:
        """保存流程实体"""
        with get_sync_db_session() as session:
            session.add(flow_entity)
            session.commit()
            session.refresh(flow_entity)
        return flow_entity
    
    @classmethod
    async def async_save(cls, flow_entity: Flow) -> Flow:
        """异步保存流程实体"""
        async with get_async_db_session() as session:
            session.add(flow_entity)
            await session.commit()
            await session.refresh(flow_entity)
        return flow_entity
    
    @classmethod
    def find_by_id(cls, entity_id: str) -> Optional[Flow]:
        """根据ID查找流程"""
        with get_sync_db_session() as session:
            stmt = select(Flow).where(Flow.id == entity_id)
            return session.exec(stmt).first()
    
    @classmethod
    async def async_find_by_id(cls, entity_id: str) -> Optional[Flow]:
        """异步根据ID查找流程"""
        async with get_async_db_session() as session:
            stmt = select(Flow).where(Flow.id == entity_id)
            result = await session.exec(stmt)
            return result.first()
    
    @classmethod
    def find_by_ids(cls, entity_ids: List[str]) -> List[Flow]:
        """根据ID列表查找流程"""
        if not entity_ids:
            return []
        with get_sync_db_session() as session:
            stmt = select(Flow).where(Flow.id.in_(entity_ids))
            return session.exec(stmt).all()
    
    @classmethod
    async def async_find_by_ids(cls, entity_ids: List[str]) -> List[Flow]:
        """异步根据ID列表查找流程"""
        if not entity_ids:
            return []
        async with get_async_db_session() as session:
            stmt = select(Flow).where(col(Flow.id).in_(entity_ids))
            result = await session.exec(stmt)
            return result.all()
    
    @classmethod
    def find_by_user(cls, user_identifier: int) -> List[Flow]:
        """根据用户ID查找流程"""
        with get_sync_db_session() as session:
            stmt = select(Flow).where(Flow.user_id == user_identifier)
            return session.exec(stmt).all()
    
    @classmethod
    def find_by_name(cls, user_identifier: int, flow_name: str) -> Optional[Flow]:
        """根据名称查找流程"""
        with get_sync_db_session() as session:
            stmt = select(Flow).where(Flow.user_id == user_identifier, Flow.name == flow_name)
            return session.exec(stmt).first()
    
    @classmethod
    def search_by_name(cls, flow_name: str) -> List[Flow]:
        """根据名称搜索流程"""
        with get_sync_db_session() as session:
            stmt = select(Flow).where(Flow.name.like('%{}%'.format(flow_name)))
            return session.exec(stmt).all()
    
    @classmethod
    def remove(cls, flow_entity: Flow) -> Flow:
        """删除流程"""
        from mep.database.models.flow_version import FlowVersion
        with get_sync_db_session() as session:
            session.delete(flow_entity)
            update_stmt = update(FlowVersion).where(
                FlowVersion.flow_id == flow_entity.id
            ).values(is_delete=1)
            session.exec(update_stmt)
            session.commit()
        return flow_entity


class FlowService:
    """流程服务层"""
    
    @classmethod
    def _map_flow_type_to_app_type(cls, flow_type_value: int) -> ApplicationTypeEnum:
        """映射流程类型到应用类型"""
        type_mapping = {
            FlowTypeEnum.FLOW.value: ApplicationTypeEnum.SKILL,
            FlowTypeEnum.WORKFLOW.value: ApplicationTypeEnum.WORKFLOW,
            FlowTypeEnum.ASSISTANT.value: ApplicationTypeEnum.ASSISTANT,
            FlowTypeEnum.LINSIGHT.value: ApplicationTypeEnum.LINSIGHT,
        }
        return type_mapping.get(flow_type_value, ApplicationTypeEnum.DAILY_CHAT)
    
    @classmethod
    def _build_flow_dict_from_row(cls, row_data: tuple) -> Dict[str, Any]:
        """从行数据构建流程字典"""
        return {
            'id': row_data[0],
            'name': row_data[1],
            'description': row_data[2],
            'flow_type': row_data[3],
            'logo': row_data[4],
            'user_id': row_data[5],
            'status': row_data[6],
            'create_time': row_data[7],
            'update_time': row_data[8]
        }
    
    @classmethod
    def create_new_flow(cls, flow_entity: Flow, flow_type_value: Optional[int]) -> Flow:
        """创建新流程"""
        from mep.database.models.flow_version import FlowVersion
        
        with get_sync_db_session() as session:
            session.add(flow_entity)
            
            version_entity = FlowVersion(
                name='v0',
                is_current=1,
                data=flow_entity.data,
                flow_id=flow_entity.id,
                create_time=datetime.now(),
                user_id=flow_entity.user_id,
                flow_type=flow_type_value
            )
            session.add(version_entity)
            session.commit()
            session.refresh(flow_entity)
            
            app_type = cls._map_flow_type_to_app_type(flow_type_value)
            telemetry_service.log_event_sync(
                user_id=flow_entity.user_id,
                event_type=BaseTelemetryTypeEnum.NEW_APPLICATION,
                trace_id=trace_id_var.get(),
                event_data=NewApplicationEventData(
                    app_id=flow_entity.id,
                    app_name=flow_entity.name,
                    app_type=app_type.value
                )
            )
            
            return flow_entity
    
    @classmethod
    def delete_flow_by_entity(cls, flow_entity: Flow) -> Flow:
        """删除流程实体"""
        return FlowRepository.remove(flow_entity)
    
    @classmethod
    def get_flow_by_identifier(cls, flow_identifier: str) -> Optional[Flow]:
        """根据标识符获取流程"""
        return FlowRepository.find_by_id(flow_identifier)
    
    @classmethod
    async def async_get_flow_by_identifier(cls, flow_identifier: str) -> Optional[Flow]:
        """异步根据标识符获取流程"""
        return await FlowRepository.async_find_by_id(flow_identifier)
    
    @classmethod
    def get_flows_by_identifiers(cls, flow_identifiers: List[str]) -> List[Flow]:
        """根据标识符列表获取流程"""
        return FlowRepository.find_by_ids(flow_identifiers)
    
    @classmethod
    async def async_get_flows_by_identifiers(cls, flow_identifiers: List[str]) -> List[Flow]:
        """异步根据标识符列表获取流程"""
        return await FlowRepository.async_find_by_ids(flow_identifiers)
    
    @classmethod
    def get_flows_by_user_identifier(cls, user_identifier: int) -> List[Flow]:
        """根据用户标识符获取流程"""
        return FlowRepository.find_by_user(user_identifier)
    
    @classmethod
    def get_flow_by_user_and_name(cls, user_identifier: int, flow_name: str) -> Optional[Flow]:
        """根据用户和名称获取流程"""
        return FlowRepository.find_by_name(user_identifier, flow_name)
    
    @classmethod
    def search_flows_by_name(cls, flow_name: str) -> List[Flow]:
        """根据名称搜索流程"""
        return FlowRepository.search_by_name(flow_name)
    
    @classmethod
    def get_flows_with_access_control(
        cls,
        role_identifier: int,
        search_name: str,
        page_size: int,
        page_num: int
    ) -> List[Tuple[Flow, RoleAccess]]:
        """获取带访问控制的流程"""
        stmt = select(Flow, RoleAccess).join(
            RoleAccess,
            and_(
                RoleAccess.role_id == role_identifier,
                RoleAccess.type == AccessType.FLOW.value,
                RoleAccess.third_id == Flow.id
            ),
            isouter=True
        )
        
        if search_name:
            stmt = stmt.where(Flow.name.like('%' + search_name + '%'))
        
        if page_num and page_size and page_num != 'undefined':
            page_num = int(page_num)
            stmt = stmt.order_by(RoleAccess.type.desc()).order_by(
                Flow.update_time.desc()
            ).offset((page_num - 1) * page_size).limit(page_size)
        
        with get_sync_db_session() as session:
            return session.exec(stmt).all()
    
    @classmethod
    def count_by_filters(cls, filter_conditions) -> int:
        """根据条件计数"""
        with get_sync_db_session() as session:
            count_stmt = session.query(func.count(Flow.id))
            return session.exec(count_stmt.where(*filter_conditions)).scalar()
    
    @classmethod
    def query_flows(
        cls,
        user_identifier: Optional[int],
        extra_identifiers: Union[List[str], str],
        search_name: str,
        status_value: Optional[int] = None,
        flow_identifiers: List[str] = None,
        page_index: int = 0,
        page_limit: int = 0,
        flow_type_value: Optional[int] = None
    ) -> List[Flow]:
        """查询流程列表"""
        with get_sync_db_session() as session:
            stmt = FlowQueryBuilder.build_base_query()
            
            if extra_identifiers and isinstance(extra_identifiers, List):
                stmt = stmt.where(or_(Flow.id.in_(extra_identifiers), Flow.user_id == user_identifier))
            elif not extra_identifiers:
                stmt = stmt.where(Flow.user_id == user_identifier)
            
            if search_name:
                stmt = stmt.where(
                    or_(Flow.name.like(f'%{search_name}%'), Flow.description.like(f'%{search_name}%'))
                )
            
            if status_value is not None:
                stmt = stmt.where(Flow.status == status_value)
            
            if flow_type_value is not None:
                stmt = stmt.where(Flow.flow_type == flow_type_value)
            
            if flow_identifiers:
                stmt = stmt.where(Flow.id.in_(flow_identifiers))
            
            stmt = stmt.order_by(Flow.update_time.desc())
            
            if page_index > 0 and page_limit > 0:
                stmt = stmt.offset((page_index - 1) * page_limit).limit(page_limit)
            
            result = session.exec(stmt)
            rows = result.mappings().all()
            return [Flow.model_validate(row) for row in rows]
    
    @classmethod
    def count_flows(
        cls,
        user_identifier: Optional[int],
        extra_identifiers: Union[List[str], str],
        search_name: str,
        status_value: Optional[int] = None,
        flow_identifiers: List[str] = None,
        flow_type_value: Optional[int] = None
    ) -> int:
        """统计流程数量"""
        with get_sync_db_session() as session:
            count_stmt = session.query(func.count(Flow.id))
            
            if extra_identifiers and isinstance(extra_identifiers, List):
                count_stmt = count_stmt.filter(
                    or_(Flow.id.in_(extra_identifiers), Flow.user_id == user_identifier)
                )
            elif not extra_identifiers:
                count_stmt = count_stmt.filter(Flow.user_id == user_identifier)
            
            if search_name:
                count_stmt = count_stmt.filter(
                    or_(Flow.name.like(f'%{search_name}%'), Flow.description.like(f'%{search_name}%'))
                )
            
            if flow_type_value is not None:
                count_stmt = count_stmt.where(Flow.flow_type == flow_type_value)
            
            if flow_identifiers:
                count_stmt = count_stmt.filter(Flow.id.in_(flow_identifiers))
            
            if status_value is not None:
                count_stmt = count_stmt.filter(Flow.status == status_value)
            
            return count_stmt.scalar()
    
    @classmethod
    def get_online_flows(
        cls,
        keyword: str = None,
        flow_identifiers: List[str] = None,
        flow_type_value: int = FlowTypeEnum.FLOW.value
    ) -> List[Flow]:
        """获取在线流程"""
        with get_sync_db_session() as session:
            stmt = select(
                Flow.id, Flow.user_id, Flow.name, Flow.status, Flow.create_time,
                Flow.logo, Flow.update_time, Flow.description, Flow.guide_word
            ).where(Flow.status == FlowStatusEnum.ONLINE.value)
            
            if flow_identifiers:
                stmt = stmt.where(Flow.id.in_(flow_identifiers))
            
            if keyword:
                stmt = stmt.where(
                    or_(Flow.name.like(f'%{keyword}%'), Flow.description.like(f'%{keyword}%'))
                )
            
            result = session.exec(stmt).mappings().all()
            return [Flow.model_validate(row) for row in result]
    
    @classmethod
    def get_user_accessible_online_flows(
        cls,
        user_identifier: int,
        page_index: int = 0,
        page_limit: int = 0,
        keyword: str = None,
        flow_identifiers: List[str] = None,
        flow_type_value: int = FlowTypeEnum.FLOW.value
    ) -> List[Flow]:
        """获取用户可访问的在线流程"""
        user_roles = UserRoleDao.get_user_roles(user_identifier)
        accessible_flow_ids = []
        
        if user_roles:
            role_ids = [role.role_id for role in user_roles]
            if 1 in role_ids:
                accessible_flow_ids = 'admin'
            else:
                role_access_list = RoleAccessDao.get_role_access(role_ids, AccessType.FLOW)
                if role_access_list:
                    accessible_flow_ids = [access.third_id for access in role_access_list]
        
        return cls.query_flows(
            user_identifier,
            accessible_flow_ids,
            keyword,
            FlowStatusEnum.ONLINE.value,
            flow_ids=flow_identifiers,
            page=page_index,
            limit=page_limit,
            flow_type=flow_type_value
        )
    
    @classmethod
    def filter_flows_by_identifiers(
        cls,
        flow_identifiers: List[str],
        keyword: str = None,
        page_index: int = 0,
        page_limit: int = 0,
        flow_type_value: int = FlowTypeEnum.FLOW.value
    ) -> Tuple[List[Flow], int]:
        """根据标识符过滤流程"""
        stmt = select(
            Flow.id, Flow.user_id, Flow.name, Flow.status, Flow.create_time,
            Flow.update_time, Flow.description, Flow.guide_word
        )
        count_stmt = select(func.count(Flow.id))
        
        if flow_identifiers:
            stmt = stmt.where(Flow.id.in_(flow_identifiers))
            count_stmt = count_stmt.where(Flow.id.in_(flow_identifiers))
        
        if keyword:
            stmt = stmt.where(
                or_(Flow.name.like(f'%{keyword}%'), Flow.description.like(f'%{keyword}%'))
            )
            count_stmt = count_stmt.where(
                or_(Flow.name.like(f'%{keyword}%'), Flow.description.like(f'%{keyword}%'))
            )
        
        if page_index and page_limit:
            stmt = stmt.offset((page_index - 1) * page_limit).limit(page_limit)
        
        stmt = stmt.where(Flow.flow_type == flow_type_value)
        stmt = stmt.order_by(Flow.update_time.desc())
        
        with get_sync_db_session() as session:
            result = session.exec(stmt).mappings().all()
            return [Flow.model_validate(row) for row in result], session.scalar(count_stmt)
    
    @classmethod
    def update_flow_entity(cls, flow_entity: Flow) -> Flow:
        """更新流程实体"""
        return FlowRepository.save(flow_entity)
    
    @classmethod
    async def async_update_flow_entity(cls, flow_entity: Flow) -> Flow:
        """异步更新流程实体"""
        return await FlowRepository.async_save(flow_entity)
    
    @classmethod
    def get_all_applications(
        cls,
        search_name: str = None,
        status_value: int = None,
        identifier_list: list = None,
        flow_type_value: int = None,
        user_identifier: int = None,
        extra_identifiers: list = None,
        exclude_identifiers: list = None,
        page_index: int = 0,
        page_limit: int = 0
    ) -> Tuple[List[Dict], int]:
        """获取所有应用"""
        sub_query = FlowQueryBuilder.build_union_query()
        
        stmt = select(
            sub_query.c.id, sub_query.c.name, sub_query.c.description,
            sub_query.c.flow_type, sub_query.c.logo, sub_query.c.user_id,
            sub_query.c.status, sub_query.c.create_time, sub_query.c.update_time
        )
        count_stmt = select(func.count(sub_query.c.id))
        
        if search_name:
            stmt = stmt.where(sub_query.c.name.like(f'%{search_name}%'))
            count_stmt = count_stmt.where(sub_query.c.name.like(f'%{search_name}%'))
        
        if status_value is not None:
            stmt = stmt.where(sub_query.c.status == status_value)
            count_stmt = count_stmt.where(sub_query.c.status == status_value)
        
        if identifier_list:
            stmt = stmt.where(sub_query.c.id.in_(identifier_list))
            count_stmt = count_stmt.where(sub_query.c.id.in_(identifier_list))
        
        if flow_type_value is not None:
            stmt = stmt.where(sub_query.c.flow_type == flow_type_value)
            count_stmt = count_stmt.where(sub_query.c.flow_type == flow_type_value)
        
        if user_identifier is not None:
            if extra_identifiers:
                stmt = stmt.where(
                    or_(sub_query.c.user_id == user_identifier, sub_query.c.id.in_(extra_identifiers))
                )
                count_stmt = count_stmt.where(
                    or_(sub_query.c.user_id == user_identifier, sub_query.c.id.in_(extra_identifiers))
                )
            else:
                stmt = stmt.where(sub_query.c.user_id == user_identifier)
                count_stmt = count_stmt.where(sub_query.c.user_id == user_identifier)
        
        if exclude_identifiers:
            stmt = stmt.where(~sub_query.c.id.in_(exclude_identifiers))
            count_stmt = count_stmt.where(~sub_query.c.id.in_(exclude_identifiers))
        
        if page_index and page_limit:
            stmt = stmt.offset((page_index - 1) * page_limit).limit(page_limit)
        
        stmt = stmt.order_by(sub_query.c.update_time.desc())
        
        with get_sync_db_session() as session:
            rows = session.exec(stmt).all()
            total = session.scalar(count_stmt)
        
        data = [cls._build_flow_dict_from_row(row) for row in rows]
        return data, total
    
    @classmethod
    async def async_get_all_applications(
        cls,
        search_name: str = None,
        status_value: int = None,
        identifier_list: list = None,
        flow_type_value: int = None,
        user_identifier: int = None,
        extra_identifiers: list = None,
        exclude_identifiers: list = None,
        page_index: int = 0,
        page_limit: int = 0
    ) -> Tuple[List[Dict], int]:
        """异步获取所有应用"""
        sub_query = FlowQueryBuilder.build_union_query()
        
        stmt = select(
            sub_query.c.id, sub_query.c.name, sub_query.c.description,
            sub_query.c.flow_type, sub_query.c.logo, sub_query.c.user_id,
            sub_query.c.status, sub_query.c.create_time, sub_query.c.update_time
        )
        count_stmt = select(func.count(sub_query.c.id))
        
        if search_name:
            stmt = stmt.where(sub_query.c.name.like(f'%{search_name}%'))
            count_stmt = count_stmt.where(sub_query.c.name.like(f'%{search_name}%'))
        
        if status_value is not None:
            stmt = stmt.where(sub_query.c.status == status_value)
            count_stmt = count_stmt.where(sub_query.c.status == status_value)
        
        if identifier_list:
            stmt = stmt.where(sub_query.c.id.in_(identifier_list))
            count_stmt = count_stmt.where(sub_query.c.id.in_(identifier_list))
        
        if flow_type_value is not None:
            stmt = stmt.where(sub_query.c.flow_type == flow_type_value)
            count_stmt = count_stmt.where(sub_query.c.flow_type == flow_type_value)
        
        if user_identifier is not None:
            if extra_identifiers:
                stmt = stmt.where(
                    or_(sub_query.c.user_id == user_identifier, sub_query.c.id.in_(extra_identifiers))
                )
                count_stmt = count_stmt.where(
                    or_(sub_query.c.user_id == user_identifier, sub_query.c.id.in_(extra_identifiers))
                )
            else:
                stmt = stmt.where(sub_query.c.user_id == user_identifier)
                count_stmt = count_stmt.where(sub_query.c.user_id == user_identifier)
        
        if exclude_identifiers:
            stmt = stmt.where(~sub_query.c.id.in_(exclude_identifiers))
            count_stmt = count_stmt.where(~sub_query.c.id.in_(exclude_identifiers))
        
        if page_index and page_limit:
            stmt = stmt.offset((page_index - 1) * page_limit).limit(page_limit)
        
        stmt = stmt.order_by(sub_query.c.update_time.desc())
        
        async with get_async_db_session() as session:
            result = await session.exec(stmt)
            rows = result.all()
            total_result = await session.exec(count_stmt)
            total = total_result.first()
        
        data = [cls._build_flow_dict_from_row(row) for row in rows]
        return data, total
    
    @classmethod
    async def async_get_simple_flow(cls, flow_identifier: str) -> Optional[Flow]:
        """异步获取简单流程信息"""
        stmt = select(
            Flow.id, Flow.name, Flow.description, Flow.flow_type, Flow.logo, Flow.user_id,
            Flow.status, Flow.create_time, Flow.update_time
        ).where(Flow.id == flow_identifier)
        
        async with get_async_db_session() as session:
            result = await session.exec(stmt)
            row = result.first()
            if not row:
                return None
            return Flow(**cls._build_flow_dict_from_row(row))
    
    @classmethod
    def get_simple_flow_sync(cls, flow_identifier: str) -> Optional[Flow]:
        """同步获取简单流程信息"""
        stmt = select(
            Flow.id, Flow.name, Flow.description, Flow.flow_type, Flow.logo, Flow.user_id,
            Flow.status, Flow.create_time, Flow.update_time
        ).where(Flow.id == flow_identifier)
        
        with get_sync_db_session() as session:
            result = session.exec(stmt)
            row = result.first()
            if not row:
                return None
            return Flow(**cls._build_flow_dict_from_row(row))
    
    @classmethod
    def get_applications_by_time_range(
        cls,
        start_time: datetime,
        end_time: datetime,
        page_index: int = 0,
        page_size: int = 0
    ) -> List[Dict]:
        """根据时间范围获取应用"""
        sub_query = FlowQueryBuilder.build_union_query()
        
        stmt = select(
            sub_query.c.id, sub_query.c.name, sub_query.c.description,
            sub_query.c.flow_type, sub_query.c.logo, sub_query.c.user_id,
            sub_query.c.status, sub_query.c.create_time, sub_query.c.update_time
        )
        stmt = stmt.where(and_(
            sub_query.c.create_time >= start_time,
            sub_query.c.create_time < end_time
        ))
        
        if page_index and page_size:
            stmt = stmt.offset((page_index - 1) * page_size).limit(page_size)
        
        with get_sync_db_session() as session:
            rows = session.exec(stmt).all()
            return [cls._build_flow_dict_from_row(row) for row in rows]
    
    @classmethod
    def get_first_application(cls) -> Optional[Dict]:
        """获取第一个应用"""
        sub_query = FlowQueryBuilder.build_union_query()
        
        stmt = select(
            sub_query.c.id, sub_query.c.name, sub_query.c.description,
            sub_query.c.flow_type, sub_query.c.logo, sub_query.c.user_id,
            sub_query.c.status, sub_query.c.create_time, sub_query.c.update_time
        ).order_by(sub_query.c.create_time.asc()).limit(1)
        
        with get_sync_db_session() as session:
            rows = session.exec(stmt).all()
            data = [cls._build_flow_dict_from_row(row) for row in rows]
            return data[0] if data else None


class FlowDao(FlowEntityBase):
    """流程数据访问对象（兼容旧接口）"""
    
    @classmethod
    def create_flow(cls, flow_info: Flow, flow_type: Optional[int]) -> Flow:
        return FlowService.create_new_flow(flow_info, flow_type)
    
    @classmethod
    def delete_flow(cls, flow_info: Flow) -> Flow:
        return FlowService.delete_flow_by_entity(flow_info)
    
    @classmethod
    def get_flow_by_id(cls, flow_id: str) -> Optional[Flow]:
        return FlowService.get_flow_by_identifier(flow_id)
    
    @classmethod
    async def aget_flow_by_id(cls, flow_id: str) -> Optional[Flow]:
        return await FlowService.async_get_flow_by_identifier(flow_id)
    
    @classmethod
    def get_flow_by_idstr(cls, flow_id: str) -> Optional[Flow]:
        return FlowService.get_flow_by_identifier(flow_id)
    
    @classmethod
    def get_flow_by_ids(cls, flow_ids: List[str]) -> List[Flow]:
        return FlowService.get_flows_by_identifiers(flow_ids)
    
    @classmethod
    async def aget_flow_by_ids(cls, flow_ids: List[str]) -> List[Flow]:
        return await FlowService.async_get_flows_by_identifiers(flow_ids)
    
    @classmethod
    def get_flow_by_user(cls, user_id: int) -> List[Flow]:
        return FlowService.get_flows_by_user_identifier(user_id)
    
    @classmethod
    def get_flow_by_name(cls, user_id: int, name: str) -> Optional[Flow]:
        return FlowService.get_flow_by_user_and_name(user_id, name)
    
    @classmethod
    def get_flow_list_by_name(cls, name: str) -> List[Flow]:
        return FlowService.search_flows_by_name(name)
    
    @classmethod
    def get_flow_by_access(cls, role_id: int, name: str, page_size: int, page_num: int) -> List[Tuple[Flow, RoleAccess]]:
        return FlowService.get_flows_with_access_control(role_id, name, page_size, page_num)
    
    @classmethod
    def get_count_by_filters(cls, filters) -> int:
        return FlowService.count_by_filters(filters)
    
    @classmethod
    def get_flows(cls, user_id: Optional[int], extra_ids: Union[List[str], str], name: str,
                  status: Optional[int] = None, flow_ids: List[str] = None,
                  page: int = 0, limit: int = 0, flow_type: Optional[int] = None) -> List[Flow]:
        return FlowService.query_flows(user_id, extra_ids, name, status, flow_ids, page, limit, flow_type)
    
    @classmethod
    def count_flows(cls, user_id: Optional[int], extra_ids: Union[List[str], str], name: str,
                    status: Optional[int] = None, flow_ids: List[str] = None,
                    flow_type: Optional[int] = None) -> int:
        return FlowService.count_flows(user_id, extra_ids, name, status, flow_ids, flow_type)
    
    @classmethod
    def get_all_online_flows(cls, keyword: str = None, flow_ids: List[str] = None,
                             flow_type: int = FlowTypeEnum.FLOW.value) -> List[Flow]:
        return FlowService.get_online_flows(keyword, flow_ids, flow_type)
    
    @classmethod
    def get_user_access_online_flows(cls, user_id: int, page: int = 0, limit: int = 0,
                                     keyword: str = None, flow_ids: List[str] = None,
                                     flow_type: int = FlowTypeEnum.FLOW.value) -> List[Flow]:
        return FlowService.get_user_accessible_online_flows(user_id, page, limit, keyword, flow_ids, flow_type)
    
    @classmethod
    def filter_flows_by_ids(cls, flow_ids: List[str], keyword: str = None,
                            page: int = 0, limit: int = 0,
                            flow_type: int = FlowTypeEnum.FLOW.value) -> Tuple[List[Flow], int]:
        return FlowService.filter_flows_by_identifiers(flow_ids, keyword, page, limit, flow_type)
    
    @classmethod
    def update_flow(cls, flow: Flow) -> Flow:
        return FlowService.update_flow_entity(flow)
    
    @classmethod
    async def aupdate_flow(cls, flow: Flow) -> Flow:
        return await FlowService.async_update_flow_entity(flow)
    
    @classmethod
    def get_all_apps(cls, name: str = None, status: int = None, id_list: list = None,
                     flow_type: int = None, user_id: int = None, id_extra: list = None,
                     id_list_not_in: list = None, page: int = 0, limit: int = 0) -> Tuple[List[Dict], int]:
        return FlowService.get_all_applications(name, status, id_list, flow_type, user_id, id_extra, id_list_not_in, page, limit)
    
    @classmethod
    async def aget_all_apps(cls, name: str = None, status: int = None, id_list: list = None,
                            flow_type: int = None, user_id: int = None, id_extra: list = None,
                            id_list_not_in: list = None, page: int = 0, limit: int = 0) -> Tuple[List[Dict], int]:
        return await FlowService.async_get_all_applications(name, status, id_list, flow_type, user_id, id_extra, id_list_not_in, page, limit)
    
    @classmethod
    async def get_one_flow_simple(cls, flow_id: str) -> Optional[Flow]:
        return await FlowService.async_get_simple_flow(flow_id)
    
    @classmethod
    def get_one_flow_simple_sync(cls, flow_id: str) -> Optional[Flow]:
        return FlowService.get_simple_flow_sync(flow_id)
    
    @classmethod
    def get_all_app_by_time_range_sync(cls, start_time: datetime, end_time: datetime,
                                       page: int = 0, page_size: int = 0):
        return FlowService.get_applications_by_time_range(start_time, end_time, page, page_size)
    
    @classmethod
    def get_first_app(cls):
        return FlowService.get_first_application()


# 兼容别名 - 适配旧的导入名称
FlowStatus = FlowStatusEnum
FlowType = FlowTypeEnum
FlowCreate = FlowCreateModel
FlowRead = FlowReadModel
FlowReadWithStyle = FlowReadWithStyleModel
FlowUpdate = FlowUpdateModel
UserLinkType = UserLinkTypeEnum
