import json
from datetime import datetime
from typing import Optional, List

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text, text, JSON, or_
from sqlmodel import Field, select, col, func, delete, update

from mep.common.models.base import SQLModelSerializable
from mep.core.database import get_async_db_session


class Task(SQLModelSerializable, table=True):
    __tablename__ = 'task'
    __table_args__ = {'comment': '任务中心 - 存储跟单任务和业务任务'}

    id: Optional[int] = Field(default=None, primary_key=True)
    task_number: str = Field(sa_column=Column(String(20), index=True, unique=True, nullable=False, comment='任务编号（SL+年月+4位序号）'))
    task_name: str = Field(sa_column=Column(String(300), index=True, nullable=False, comment='任务名称'))
    task_type: str = Field(sa_column=Column(String(100), index=True, nullable=False, comment='任务类型'))
    status: str = Field(default='in_progress', sa_column=Column(String(50), index=True, nullable=False, server_default=text("'in_progress'"), comment='任务状态（in_progress/done）'))
    priority_label: Optional[str] = Field(default='普通', sa_column=Column(String(50), nullable=True, server_default=text("'普通'"), comment='优先级标签'))
    agent_id: Optional[str] = Field(default=None, sa_column=Column(String(200), nullable=True, comment='关联智能体ID'))
    chat_id: Optional[str] = Field(default=None, sa_column=Column(String(200), unique=True, nullable=True, comment='关联会话ID'))
    assignee_id: Optional[int] = Field(default=None, sa_column=Column(Integer, index=True, nullable=True, comment='负责人用户ID'))
    creator_id: Optional[int] = Field(default=None, sa_column=Column(Integer, index=True, nullable=True, comment='创建人用户ID'))
    due_date: Optional[datetime] = Field(default=None, sa_column=Column(DateTime, nullable=True, comment='截止日期'))
    description: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True, comment='任务描述'))
    main_form_type: Optional[str] = Field(default=None, sa_column=Column(String(100), nullable=True, comment='主表单类型'))
    main_form_id: Optional[int] = Field(default=None, sa_column=Column(Integer, nullable=True, comment='主表单ID'))
    tags: Optional[list] = Field(default=None, sa_column=Column(JSON, nullable=True, comment='标签JSON数组'))
    extra: Optional[dict] = Field(default=None, sa_column=Column(JSON, nullable=True, comment='扩展数据JSON'))
    create_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP'), comment='创建时间'))
    update_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), comment='更新时间'))


class TaskFocus(SQLModelSerializable, table=True):
    __tablename__ = 'task_focus'
    __table_args__ = {'comment': '任务关注 - 记录用户关注的任务'}

    id: Optional[int] = Field(default=None, primary_key=True)
    task_id: int = Field(sa_column=Column(Integer, index=True, nullable=False, comment='关联任务ID'))
    user_id: int = Field(sa_column=Column(Integer, index=True, nullable=False, comment='关注用户ID'))
    create_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP'), comment='关注时间'))


class TaskForm(SQLModelSerializable, table=True):
    __tablename__ = 'task_form'
    __table_args__ = {'comment': '任务表单关联 - 任务关联的业务表单'}

    id: Optional[int] = Field(default=None, primary_key=True)
    task_id: int = Field(sa_column=Column(Integer, index=True, nullable=False, comment='关联任务ID'))
    form_type: str = Field(sa_column=Column(String(100), nullable=False, comment='表单类型'))
    form_id: Optional[int] = Field(default=None, sa_column=Column(Integer, nullable=True, comment='表单记录ID'))
    form_name: str = Field(sa_column=Column(String(300), nullable=False, comment='表单名称'))
    is_main: Optional[bool] = Field(default=False, sa_column=Column(Boolean, nullable=False, server_default=text('0'), comment='是否主表单'))
    create_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP'), comment='创建时间'))


class TaskUpdateLog(SQLModelSerializable, table=True):
    __tablename__ = 'task_update_log'
    __table_args__ = {'comment': '任务更新日志 - 记录任务变更历史'}

    id: Optional[int] = Field(default=None, primary_key=True)
    task_id: int = Field(sa_column=Column(Integer, index=True, nullable=False, comment='关联任务ID'))
    log_type: str = Field(sa_column=Column(String(50), nullable=False, comment='日志类型'))
    form_type: Optional[str] = Field(default=None, sa_column=Column(String(100), nullable=True, comment='关联表单类型'))
    form_id: Optional[int] = Field(default=None, sa_column=Column(Integer, nullable=True, comment='关联表单ID'))
    content: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True, comment='日志内容'))
    detail: Optional[dict] = Field(default=None, sa_column=Column(JSON, nullable=True, comment='详细数据JSON'))
    user_id: Optional[int] = Field(default=None, sa_column=Column(Integer, nullable=True, comment='操作用户ID'))
    user_name: Optional[str] = Field(default=None, sa_column=Column(String(200), nullable=True, comment='操作用户名'))
    create_time: Optional[datetime] = Field(default=None, sa_column=Column(
        DateTime, nullable=False, server_default=text('CURRENT_TIMESTAMP'), comment='创建时间'))


# ---------------------------------------------------------------------------
# Task number generator: SL + YY + MM + 4-digit sequence
# ---------------------------------------------------------------------------

async def generate_task_number() -> str:
    now = datetime.now()
    prefix = f"SL{now.strftime('%y%m')}"
    async with get_async_db_session() as session:
        result = await session.exec(
            select(func.max(Task.task_number)).where(Task.task_number.like(f'{prefix}%'))
        )
        last = result.first()
    if last:
        seq = int(last[-4:]) + 1
    else:
        seq = 1
    return f"{prefix}{seq:04d}"


# ---------------------------------------------------------------------------
# DAO
# ---------------------------------------------------------------------------

class TaskDao:

    @classmethod
    async def create_task(cls, task: Task) -> Task:
        async with get_async_db_session() as session:
            session.add(task)
            await session.commit()
            await session.refresh(task)
            return task

    @classmethod
    async def get_task(cls, task_id: int) -> Optional[Task]:
        async with get_async_db_session() as session:
            return (await session.exec(select(Task).where(Task.id == task_id))).first()

    @classmethod
    async def find_by_number(cls, task_number: str) -> Optional[Task]:
        async with get_async_db_session() as session:
            return (await session.exec(
                select(Task).where(Task.task_number == task_number)
            )).first()

    @classmethod
    async def update_task(cls, task_id: int, data: dict) -> Optional[Task]:
        async with get_async_db_session() as session:
            item = (await session.exec(select(Task).where(Task.id == task_id))).first()
            if not item:
                return None
            for k, v in data.items():
                if k not in ('id', 'task_number', 'create_time', 'update_time') and hasattr(item, k):
                    setattr(item, k, v)
            session.add(item)
            await session.commit()
            await session.refresh(item)
            return item

    @classmethod
    async def list_tasks(cls, *, user_id: Optional[int] = None, is_admin: bool = False,
                         status: Optional[str] = None, task_type: Optional[str] = None,
                         keyword: Optional[str] = None, page: int = 1, page_size: int = 20,
                         sort_by: str = 'create_time', sort_order: str = 'desc'):
        async with get_async_db_session() as session:
            stmt = select(Task)
            count_stmt = select(func.count()).select_from(Task)

            conditions = []
            if not is_admin and user_id is not None:
                user_filter = or_(Task.assignee_id == user_id, Task.creator_id == user_id)
                conditions.append(user_filter)
            if status:
                if status == 'in_progress':
                    conditions.append(Task.status != 'done')
                else:
                    conditions.append(Task.status == status)
            if task_type:
                conditions.append(Task.task_type == task_type)
            if keyword:
                kw = f'%{keyword}%'
                conditions.append(or_(
                    col(Task.task_name).contains(keyword),
                    col(Task.task_number).contains(keyword),
                    col(Task.description).contains(keyword) if True else True
                ))

            for c in conditions:
                stmt = stmt.where(c)
                count_stmt = count_stmt.where(c)

            total = (await session.exec(count_stmt)).one()

            if sort_by and hasattr(Task, sort_by):
                order_col = getattr(Task, sort_by)
                stmt = stmt.order_by(order_col.desc() if sort_order == 'desc' else order_col.asc())
            else:
                stmt = stmt.order_by(col(Task.create_time).desc())

            stmt = stmt.offset((page - 1) * page_size).limit(page_size)
            items = (await session.exec(stmt)).all()
            return items, total

    @classmethod
    async def get_stats(cls, user_id: Optional[int] = None, is_admin: bool = False):
        async with get_async_db_session() as session:
            base = select(func.count()).select_from(Task)
            if not is_admin and user_id is not None:
                user_filter = or_(Task.assignee_id == user_id, Task.creator_id == user_id)
                base = base.where(user_filter)

            total_stmt = base
            in_progress_stmt = base.where(Task.status != 'done')
            done_stmt = base.where(Task.status == 'done')

            total = (await session.exec(total_stmt)).one()
            in_progress = (await session.exec(in_progress_stmt)).one()
            done = (await session.exec(done_stmt)).one()

            return {
                'total': total,
                'in_progress': in_progress,
                'done': done,
            }

    @classmethod
    async def get_risk_count(cls, user_id: Optional[int] = None, is_admin: bool = False):
        """Overdue tasks: due_date < now AND status != done"""
        async with get_async_db_session() as session:
            stmt = select(func.count()).select_from(Task).where(
                Task.status != 'done',
                Task.due_date != None,  # noqa
                Task.due_date < func.now()
            )
            if not is_admin and user_id is not None:
                stmt = stmt.where(or_(Task.assignee_id == user_id, Task.creator_id == user_id))
            overdue = (await session.exec(stmt)).one()
            return overdue


    @classmethod
    async def find_by_po(cls, po: str) -> Optional[Task]:
        """Find an existing task by PO number (stored in tags JSON array)."""
        if not po:
            return None
        async with get_async_db_session() as session:
            from sqlalchemy import text as sa_text
            rows = (await session.execute(
                sa_text(
                    "SELECT id FROM task WHERE task_type = '跟单任务' "
                    "AND JSON_CONTAINS(tags, :po_json) ORDER BY id DESC LIMIT 1"
                ),
                {'po_json': json.dumps(po)},
            )).first()
            if not rows:
                return None
            return (await session.exec(select(Task).where(Task.id == rows[0]))).first()


class TaskFocusDao:

    @classmethod
    async def toggle_focus(cls, task_id: int, user_id: int) -> bool:
        """Returns True if focus was added, False if removed."""
        async with get_async_db_session() as session:
            existing = (await session.exec(
                select(TaskFocus).where(TaskFocus.task_id == task_id, TaskFocus.user_id == user_id)
            )).first()
            if existing:
                await session.exec(
                    delete(TaskFocus).where(TaskFocus.id == existing.id)
                )
                await session.commit()
                return False
            else:
                session.add(TaskFocus(task_id=task_id, user_id=user_id))
                await session.commit()
                return True

    @classmethod
    async def get_focused_task_ids(cls, user_id: int) -> List[int]:
        async with get_async_db_session() as session:
            result = await session.exec(
                select(TaskFocus.task_id).where(TaskFocus.user_id == user_id)
            )
            return result.all()

    @classmethod
    async def count_focused(cls, user_id: int, task_ids: Optional[List[int]] = None) -> int:
        async with get_async_db_session() as session:
            stmt = select(func.count()).select_from(TaskFocus).where(TaskFocus.user_id == user_id)
            if task_ids is not None:
                stmt = stmt.where(TaskFocus.task_id.in_(task_ids))
            return (await session.exec(stmt)).one()


class TaskFormDao:

    @classmethod
    async def list_forms(cls, task_id: int) -> List[TaskForm]:
        async with get_async_db_session() as session:
            result = await session.exec(
                select(TaskForm).where(TaskForm.task_id == task_id).order_by(col(TaskForm.is_main).desc(), col(TaskForm.id).asc())
            )
            return result.all()

    @classmethod
    async def add_form(cls, form: TaskForm) -> TaskForm:
        async with get_async_db_session() as session:
            session.add(form)
            await session.commit()
            await session.refresh(form)
            return form

    @classmethod
    async def delete_form(cls, form_id: int):
        async with get_async_db_session() as session:
            await session.exec(delete(TaskForm).where(TaskForm.id == form_id))
            await session.commit()


class TaskUpdateLogDao:

    @classmethod
    async def list_logs(cls, task_id: int, page: int = 1, page_size: int = 50) -> tuple:
        async with get_async_db_session() as session:
            stmt = select(TaskUpdateLog).where(TaskUpdateLog.task_id == task_id)
            count_stmt = select(func.count()).select_from(TaskUpdateLog).where(TaskUpdateLog.task_id == task_id)
            total = (await session.exec(count_stmt)).one()
            stmt = stmt.order_by(col(TaskUpdateLog.create_time).desc())
            stmt = stmt.offset((page - 1) * page_size).limit(page_size)
            items = (await session.exec(stmt)).all()
            return items, total

    @classmethod
    async def add_log(cls, log: TaskUpdateLog) -> TaskUpdateLog:
        async with get_async_db_session() as session:
            session.add(log)
            await session.commit()
            await session.refresh(log)
            return log

    @classmethod
    async def get_latest_log(cls, task_id: int) -> Optional[TaskUpdateLog]:
        async with get_async_db_session() as session:
            result = await session.exec(
                select(TaskUpdateLog).where(TaskUpdateLog.task_id == task_id)
                .order_by(col(TaskUpdateLog.create_time).desc()).limit(1)
            )
            return result.first()
