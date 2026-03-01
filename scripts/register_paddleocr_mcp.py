"""One-time script to register paddleocr_mcp as a tool in the MEP tool system.

Run inside mep-backend container:
    cd /app && python scripts/register_paddleocr_mcp.py
"""

import asyncio
import json
import sys
import os

sys.path.insert(0, '/app')
os.environ.setdefault('PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK', 'True')

MCP_CONFIG_STR = json.dumps({
    "mcpServers": {
        "paddleocr": {
            "command": "paddleocr_mcp",
            "args": [],
            "name": "PaddleOCR",
            "description": "OCR 文字识别和版面分析工具，支持图片和 PDF 的文字检测、识别",
            "env": {
                "PADDLEOCR_MCP_PIPELINE": "OCR",
                "PADDLEOCR_MCP_PPOCR_SOURCE": "local",
                "PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK": "True",
            }
        }
    }
})

ADMIN_USER_ID = 1


async def main():
    from mep.tool.domain.models.gpts_tools import GptsTools, GptsToolsType, GptsToolsDao
    from mep.tool.domain.const import ToolPresetType
    from mep.mcp_manage.manager import ClientManager
    from mep.utils import md5_hash

    existing = await GptsToolsDao.get_one_tool_type_by_name(ADMIN_USER_ID, 'PaddleOCR')
    if existing:
        print(f'PaddleOCR tool type already registered (id={existing.id}). Skipping.')
        return

    mcp_config = json.loads(MCP_CONFIG_STR)
    tool_name = 'PaddleOCR'
    tool_desc = 'OCR 文字识别和版面分析工具，支持图片和 PDF 的文字检测、识别'

    print('Connecting to paddleocr_mcp via stdio...')
    client = ClientManager.sync_connect_mcp_from_json(mcp_config)

    print('Discovering tools...')
    tools = await client.list_tools()
    print(f'Found {len(tools)} tools:')
    for t in tools:
        desc_preview = (t.description or '')[:80]
        print(f'  - {t.name}: {desc_preview}')

    tool_type = GptsToolsType(
        name=tool_name,
        description=tool_desc,
        server_host='',
        is_preset=ToolPresetType.MCP.value,
        openapi_schema=MCP_CONFIG_STR,
        extra=json.dumps({"api_location": "", "parameter_name": ""}),
        user_id=ADMIN_USER_ID,
    )

    from mep.core.database import get_async_db_session
    async with get_async_db_session() as session:
        session.add(tool_type)
        await session.commit()
        await session.refresh(tool_type)

        children = []
        for t in tools:
            child = GptsTools(
                name=t.name,
                desc=t.description,
                tool_key=f'tool_type_{tool_type.id}_{md5_hash(t.name)}',
                type=tool_type.id,
                is_preset=ToolPresetType.MCP.value,
                api_params=_convert_input_schema(t.inputSchema),
                extra=t.model_dump_json(),
                user_id=ADMIN_USER_ID,
                is_delete=0,
            )
            children.append(child)

        if children:
            session.add_all(children)
            await session.commit()

    print(f'\nRegistered PaddleOCR MCP (tool_type_id={tool_type.id}) with {len(children)} tools.')


def _convert_input_schema(schema: dict) -> list[dict]:
    """Convert MCP inputSchema to MEP api_params format."""
    if not schema:
        return []
    props = schema.get('properties', {})
    required = set(schema.get('required', []))
    params = []
    for name, info in props.items():
        params.append({
            'in': 'body',
            'name': name,
            'description': info.get('description', ''),
            'required': name in required,
            'schema': {'type': info.get('type', 'string')},
        })
    return params


if __name__ == '__main__':
    asyncio.run(main())
