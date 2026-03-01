"""
Register the updated sales order processing tool.
This tool calls POST /api/v1/sales-order/process
"""

import json
import hashlib
from sqlmodel import Session, create_engine, text
from mep.common.services.config_service import settings

engine = create_engine(settings.database_url)

tool_schema = json.dumps({
    "openapi": "3.1.0",
    "info": {
        "title": "客户销售订单解析",
        "description": "客户销售订单解析工作流（PaddleOCR版），用于解析销售订单PDF文件并写入数据库，自动生成装箱单",
        "version": "2.0.0",
    },
    "servers": [{"url": "http://backend:7860"}],
    "paths": {
        "/api/v1/sales-order/process": {
            "post": {
                "operationId": "process_sales_order_v2",
                "summary": "解析客户销售订单PDF",
                "description": "上传销售订单PDF文件URL，通过PaddleOCR识别文字，LLM结构化提取，解析订单数据写入数据库，生成装箱单，存入文档中心",
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "required": ["file_url"],
                                "properties": {
                                    "file_url": {
                                        "type": "string",
                                        "description": "销售订单PDF文件的URL地址",
                                    },
                                    "file_name": {
                                        "type": "string",
                                        "description": "文件名称（可选）",
                                    },
                                    "knowledge_id": {
                                        "type": "integer",
                                        "description": "文档中心知识库ID，用于存储解析后的文件（可选）",
                                    },
                                },
                            }
                        }
                    },
                },
                "responses": {"200": {"description": "解析结果"}},
            }
        }
    },
}, ensure_ascii=False)

with Session(engine) as session:
    existing = session.exec(
        text("SELECT id FROM t_gpts_tools_type WHERE name = '客户销售订单解析' ORDER BY id DESC LIMIT 1")
    ).first()

    if existing:
        type_id = existing[0]
        session.exec(
            text("UPDATE t_gpts_tools_type SET openapi_schema = :schema, description = :desc WHERE id = :id"),
            params={
                "schema": tool_schema,
                "desc": "客户销售订单解析工作流（PaddleOCR版）",
                "id": type_id,
            },
        )
        print(f"Updated existing tool type: id={type_id}")
    else:
        session.exec(
            text(
                "INSERT INTO t_gpts_tools_type (name, description, server_host, auth_method, api_key, auth_type, is_preset, is_delete, openapi_schema) "
                "VALUES (:name, :desc, :host, 0, '', 'basic', 0, 0, :schema)"
            ),
            params={
                "name": "客户销售订单解析",
                "desc": "客户销售订单解析工作流（PaddleOCR版）",
                "host": "http://backend:7860",
                "schema": tool_schema,
            },
        )
        type_id = session.exec(
            text("SELECT id FROM t_gpts_tools_type WHERE name = '客户销售订单解析' ORDER BY id DESC LIMIT 1")
        ).first()[0]
        print(f"Created new tool type: id={type_id}")

    tool_hash = hashlib.md5("process_sales_order_v2".encode()).hexdigest()
    tool_key = f"tool_type_{type_id}_{tool_hash}"

    extra = json.dumps({
        "path": "/api/v1/sales-order/process",
        "method": "post",
        "description": "解析客户销售订单PDF文件",
        "operationId": "process_sales_order_v2",
        "parameters": [],
        "requestBody": {
            "required": True,
            "content": {
                "application/json": {
                    "schema": {
                        "type": "object",
                        "required": ["file_url"],
                        "properties": {
                            "file_url": {"type": "string", "description": "销售订单PDF文件的URL地址"},
                            "file_name": {"type": "string", "description": "文件名称"},
                            "knowledge_id": {"type": "integer", "description": "文档中心知识库ID"},
                        },
                    }
                }
            },
        },
    }, ensure_ascii=False)

    params_json = json.dumps([
        {"name": "file_url", "in": "body", "required": True, "schema": {"type": "string"}, "description": "销售订单PDF文件URL"},
        {"name": "file_name", "in": "body", "required": False, "schema": {"type": "string"}, "description": "文件名称"},
        {"name": "knowledge_id", "in": "body", "required": False, "schema": {"type": "integer"}, "description": "文档中心知识库ID"},
    ], ensure_ascii=False)

    existing_tool = session.exec(
        text("SELECT id FROM t_gpts_tools WHERE tool_key = :key LIMIT 1"),
        params={"key": tool_key},
    ).first()

    if existing_tool:
        session.exec(
            text("UPDATE t_gpts_tools SET extra = :extra, api_params = :params WHERE id = :id"),
            params={"extra": extra, "params": params_json, "id": existing_tool[0]},
        )
        print(f"Updated existing tool: id={existing_tool[0]}")
    else:
        session.exec(
            text(
                "INSERT INTO t_gpts_tools (name, logo, `desc`, tool_key, type, extra, is_preset, is_delete, api_params) "
                "VALUES (:name, '', :desc, :key, :tid, :extra, 0, 0, :params)"
            ),
            params={
                "name": "解析客户销售订单",
                "desc": "解析客户销售订单PDF文件，提取订单数据，生成装箱单",
                "key": tool_key,
                "tid": type_id,
                "extra": extra,
                "params": params_json,
            },
        )
        print(f"Created new tool: key={tool_key}")

    session.commit()
    print("Done!")
