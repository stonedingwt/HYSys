"""Database metadata API - provides table/column introspection for DatabaseManage UI."""

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from loguru import logger
from sqlalchemy import text

from mep.core.database.manager import get_database_connection

router = APIRouter(prefix='/db/meta', tags=['DatabaseMeta'])


def _safe_default(val):
    """Ensure COLUMN_DEFAULT is JSON-serializable."""
    if val is None:
        return None
    if isinstance(val, bytes):
        return val.decode('utf-8', errors='replace')
    return str(val)


@router.get('/tables')
async def get_table_meta():
    """Return metadata for all tables and columns from INFORMATION_SCHEMA."""
    try:
        db = await get_database_connection()
        async with db.async_session() as session:
            tables_rows = (await session.execute(text(
                "SELECT TABLE_NAME, TABLE_COMMENT, TABLE_ROWS "
                "FROM INFORMATION_SCHEMA.TABLES "
                "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' "
                "ORDER BY TABLE_NAME"
            ))).all()

            result = []
            for table_name, table_comment, row_count in tables_rows:
                cols_rows = (await session.execute(
                    text(
                        "SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, "
                        "COLUMN_KEY, COLUMN_DEFAULT, COLUMN_COMMENT "
                        "FROM INFORMATION_SCHEMA.COLUMNS "
                        "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :tn "
                        "ORDER BY ORDINAL_POSITION"
                    ),
                    {'tn': table_name},
                )).all()

                columns = [
                    {
                        'name': c[0],
                        'type': c[1],
                        'nullable': c[2] == 'YES',
                        'key': c[3] or '',
                        'default': _safe_default(c[4]),
                        'comment': c[5] or '',
                    }
                    for c in cols_rows
                ]

                result.append({
                    'table_name': table_name,
                    'comment': table_comment or '',
                    'row_count': row_count or 0,
                    'columns': columns,
                })

            return JSONResponse(content=result, media_type="application/json")

    except Exception as e:
        logger.exception('get_table_meta failed')
        return JSONResponse(
            content={"error": str(e)},
            status_code=500,
            media_type="application/json",
        )
