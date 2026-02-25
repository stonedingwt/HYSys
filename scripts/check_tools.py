import json
from sqlmodel import Session, create_engine, text
from mep.common.services.config_service import settings

engine = create_engine(settings.database_url)
with Session(engine) as session:
    print("=== Welcome message check ===")
    r = session.exec(text("SELECT value FROM config WHERE `key` = 'workstation'")).first()
    if r:
        val = json.loads(r[0])
        print("welcomeMessage:", val.get("welcomeMessage"))
        print("functionDescription:", val.get("functionDescription"))

    print("\n=== t_gpts_tools for type 158, 159 ===")
    tools = session.exec(text("SELECT id, name, tool_key, `type`, is_delete, extra FROM t_gpts_tools WHERE `type` IN (158, 159)")).all()
    for t in tools:
        extra_str = str(t[5])[:200] + "..." if t[5] and len(str(t[5])) > 200 else t[5]
        print(f"  id={t[0]}, name={t[1]}, tool_key={t[2]}, type={t[3]}, is_delete={t[4]}, extra={extra_str}")

    print("\n=== t_gpts_tools_type for 158, 159 full details ===")
    types = session.exec(text("SELECT id, name, server_host, openapi_schema, is_delete FROM t_gpts_tools_type WHERE id IN (158, 159)")).all()
    for t in types:
        schema_str = str(t[3])[:300] + "..." if t[3] and len(str(t[3])) > 300 else t[3]
        print(f"  id={t[0]}, name={t[1]}, server_host={t[2]}, is_delete={t[3]}")
        print(f"  openapi_schema (truncated)={schema_str}")
