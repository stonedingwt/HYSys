import json, hashlib
from sqlmodel import Session, create_engine, text
from mep.common.services.config_service import settings

engine = create_engine(settings.database_url)

tp_flow_id = "dc06032fa9e942038861da1d22944ec5"
so_flow_id = "2d615d62073d4970ac63acf4d6dd957f"

tp_schema = json.dumps({
    "openapi": "3.1.0",
    "info": {"title": "客户TP解析", "description": "客户TP文件解析工作流，用于解析TP文件并生成跟单任务", "version": "1.0.0"},
    "servers": [{"url": "http://backend:7860"}],
    "paths": {
        f"/api/v1/process/{tp_flow_id}": {
            "post": {
                "operationId": "process_tp_workflow",
                "summary": "执行客户TP文件解析",
                "description": "解析客户TP文件，提取款号、客户、颜色、尺码等信息并生成跟单任务",
                "requestBody": {"required": True, "content": {"application/json": {"schema": {"type": "object", "properties": {"inputs": {"type": "object", "description": "输入参数"}, "tweaks": {"type": "object", "description": "调整参数"}}}}}},
                "responses": {"200": {"description": "解析结果"}}
            }
        }
    }
}, ensure_ascii=False)

so_schema = json.dumps({
    "openapi": "3.1.0",
    "info": {"title": "客户销售订单解析", "description": "客户销售订单解析工作流，用于解析销售订单并生成跟单任务", "version": "1.0.0"},
    "servers": [{"url": "http://backend:7860"}],
    "paths": {
        f"/api/v1/process/{so_flow_id}": {
            "post": {
                "operationId": "process_sales_order_workflow",
                "summary": "执行客户销售订单解析",
                "description": "解析客户销售订单文件，提取订单号、客户、产品、数量等信息并生成跟单任务",
                "requestBody": {"required": True, "content": {"application/json": {"schema": {"type": "object", "properties": {"inputs": {"type": "object", "description": "输入参数"}, "tweaks": {"type": "object", "description": "调整参数"}}}}}},
                "responses": {"200": {"description": "解析结果"}}
            }
        }
    }
}, ensure_ascii=False)

with Session(engine) as session:
    session.exec(text(
        "INSERT INTO t_gpts_tools_type (name, description, server_host, auth_method, api_key, auth_type, is_preset, is_delete, openapi_schema) VALUES (:name, :desc, :host, 0, '', 'basic', 0, 0, :schema)"
    ), params={"name": "客户TP解析", "desc": "客户TP文件解析工作流", "host": "http://backend:7860", "schema": tp_schema})
    session.exec(text(
        "INSERT INTO t_gpts_tools_type (name, description, server_host, auth_method, api_key, auth_type, is_preset, is_delete, openapi_schema) VALUES (:name, :desc, :host, 0, '', 'basic', 0, 0, :schema)"
    ), params={"name": "客户销售订单解析", "desc": "客户销售订单解析工作流", "host": "http://backend:7860", "schema": so_schema})
    session.commit()

    tp_type_id = session.exec(text("SELECT id FROM t_gpts_tools_type WHERE name = '客户TP解析' ORDER BY id DESC LIMIT 1")).first()[0]
    so_type_id = session.exec(text("SELECT id FROM t_gpts_tools_type WHERE name = '客户销售订单解析' ORDER BY id DESC LIMIT 1")).first()[0]

    tp_hash = hashlib.md5("process_tp_workflow".encode()).hexdigest()
    so_hash = hashlib.md5("process_sales_order_workflow".encode()).hexdigest()

    tp_extra = json.dumps({"path": f"/api/v1/process/{tp_flow_id}", "method": "post", "description": "解析客户TP文件并生成跟单任务", "operationId": "process_tp_workflow", "parameters": [], "requestBody": {"required": True, "content": {"application/json": {"schema": {"type": "object", "properties": {"inputs": {"type": "object"}, "tweaks": {"type": "object"}}}}}}}, ensure_ascii=False)
    so_extra = json.dumps({"path": f"/api/v1/process/{so_flow_id}", "method": "post", "description": "解析客户销售订单文件并生成跟单任务", "operationId": "process_sales_order_workflow", "parameters": [], "requestBody": {"required": True, "content": {"application/json": {"schema": {"type": "object", "properties": {"inputs": {"type": "object"}, "tweaks": {"type": "object"}}}}}}}, ensure_ascii=False)
    params_json = json.dumps([{"name": "inputs", "in": "body", "required": False, "schema": {"type": "object"}, "description": "输入参数"}, {"name": "tweaks", "in": "body", "required": False, "schema": {"type": "object"}, "description": "调整参数"}], ensure_ascii=False)

    session.exec(text(
        "INSERT INTO t_gpts_tools (name, logo, `desc`, tool_key, type, extra, is_preset, is_delete, api_params) VALUES (:name, '', :desc, :key, :tid, :extra, 0, 0, :params)"
    ), params={"name": "执行客户TP文件解析", "desc": "解析客户TP文件并生成跟单任务", "key": f"tool_type_{tp_type_id}_{tp_hash}", "tid": tp_type_id, "extra": tp_extra, "params": params_json})
    session.exec(text(
        "INSERT INTO t_gpts_tools (name, logo, `desc`, tool_key, type, extra, is_preset, is_delete, api_params) VALUES (:name, '', :desc, :key, :tid, :extra, 0, 0, :params)"
    ), params={"name": "执行客户销售订单解析", "desc": "解析客户销售订单文件并生成跟单任务", "key": f"tool_type_{so_type_id}_{so_hash}", "tid": so_type_id, "extra": so_extra, "params": params_json})
    session.commit()

    print(f"TP tool: type_id={tp_type_id}, key=tool_type_{tp_type_id}_{tp_hash}")
    print(f"SO tool: type_id={so_type_id}, key=tool_type_{so_type_id}_{so_hash}")
    print("Done!")
