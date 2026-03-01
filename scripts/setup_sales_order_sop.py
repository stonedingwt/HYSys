"""
Setup script for Sales Order Parsing SOP in Linsight mode.
1. Register the SOP in linsight_sop table
2. Update workstation config to use the new tool (tool_id=159)
"""

import json
import sys
sys.path.insert(0, '/app')

from sqlmodel import Session, create_engine, text
from mep.common.services.config_service import settings

engine = create_engine(settings.database_url)

# ────────────────────────────────────────────
# SOP Content
# ────────────────────────────────────────────

SOP_NAME = '客户销售订单解析SOP'
SOP_DESCRIPTION = '标准化客户销售订单PDF解析流程：通过PaddleOCR提取文字，LLM结构化，自动解析入库并生成装箱单'

SOP_CONTENT = r"""# 客户销售订单解析 SOP

## 概述

### 背景和适用场景
本指导手册适用于用户在灵境模式下上传客户销售订单PDF文件，需要自动解析订单内容并写入系统数据库的场景。支持的客户格式包括：
- 0978635 客户格式
- 138731（HKM）客户格式
- 通用表格格式

### 目标
1. 接收用户上传的销售订单PDF文件
2. 通过PaddleOCR提取PDF中的文字内容
3. 使用LLM对OCR文字进行结构化处理
4. 自动识别客户格式并解析订单头和明细
5. 将解析结果写入销售订单数据库
6. 自动生成装箱单Excel文件
7. 将源文件和解析结果存入赛乐文档中心
8. 向用户反馈解析结果摘要

## 所需工具和资源

1. @解析客户销售订单@ — 核心工具，调用后端 `/api/v1/sales-order/process` 接口，自动完成 OCR → 结构化 → 解析 → 入库 → 装箱单生成的全流程
2. @ocr@ — PaddleOCR 文字识别工具，用于在需要预览OCR效果时独立调用
3. 内置工具 `read_text_file` — 用于读取用户上传的文件信息
4. 内置工具 `search_knowledge_base` — 用于查询知识库中的解析规则

## 步骤说明

### 步骤一：接收并识别用户上传的文件

#### 步骤概述
- **本步骤目标**：确认用户上传了PDF文件，获取文件的URL地址和文件名
- **本步骤交付结果**：文件URL、文件名、以及文件类型确认
- **依赖前序步骤**：无
- **拆解为多个互不影响的子步骤执行**：否

#### 步骤详情
（1）检查用户的消息内容，确认用户的意图是解析销售订单
（2）从用户上传的文件信息中提取文件URL地址（file_url）和文件名称（file_name）
（3）确认文件为PDF格式（通过文件扩展名或MIME类型判断）
（4）如果用户没有上传文件，但提供了文件URL链接，直接使用该URL
（5）如果用户同时上传了多个文件，逐一记录每个文件的URL和文件名，后续将逐一处理

#### 注意事项
- 如果用户上传的不是PDF文件（如图片），仍然可以尝试处理，但需提醒用户最佳格式为PDF
- 如果无法获取文件URL，请向用户说明并请求重新上传

### 步骤二：调用销售订单解析工具

#### 步骤概述
- **本步骤目标**：调用 @解析客户销售订单@ 工具对PDF文件执行全流程解析
- **本步骤交付结果**：解析结果JSON，包含订单头ID、订单数量、装箱单URL等
- **依赖前序步骤**：步骤一
- **拆解为多个互不影响的子步骤执行**：是（当有多个文件时，每个文件独立处理）

#### 步骤详情
（1）使用 @解析客户销售订单@ 工具，传入以下参数：
   - `file_url`：步骤一获取的PDF文件URL地址（必填）
   - `file_name`：文件名称（选填，有助于结果标识）
   - `knowledge_id`：赛乐文档中心知识库ID（选填，传入后会自动将文件和解析结果存入文档中心）
（2）等待工具返回结果，结果包含：
   - `header_ids`：新创建的订单头ID列表
   - `order_count`：成功解析的订单数量
   - `packing_lists`：生成的装箱单信息（每个订单对应一个装箱单URL）
   - `doc_center`：存入文档中心的文件信息
   - `message`：处理结果消息
（3）如果有多个文件，对每个文件重复执行步骤（1）和（2）

#### 注意事项
- 工具内部会自动完成以下流程：PaddleOCR文字提取 → LLM结构化 → 客户格式识别 → 订单解析 → 数据库写入 → 装箱单生成 → 文档中心存储
- 如果工具返回错误（如OCR失败、解析失败），记录错误信息，在后续步骤中反馈给用户
- 工具的调用可能需要较长时间（30秒到2分钟），请耐心等待

### 步骤三：交付与汇报

#### 步骤概述
- **本步骤目标**：整理解析结果并向用户清晰报告
- **本步骤交付结果**：格式化的解析结果报告
- **依赖前序步骤**：步骤二
- **拆解为多个互不影响的子步骤执行**：否

#### 步骤详情
（1）汇总所有文件的处理结果
（2）对于每个成功处理的文件，整理以下信息：
   - 文件名
   - 解析出的订单数量
   - 每个订单的基本信息（PO号、客户名称、总金额等）
   - 装箱单下载链接（如有）
   - 文档中心存储状态
（3）对于处理失败的文件，说明失败原因和建议
（4）以表格或列表形式向用户呈现处理结果
（5）提示用户可以在工作台的销售订单页面查看详细数据

#### 注意事项
- 报告内容应简洁明了，突出关键信息
- 如果所有文件都处理失败，需要向用户说明可能的原因（如文件格式不支持、PDF扫描质量差等），并建议解决方案
- 装箱单URL应以可点击的链接形式提供

## 总结

本SOP通过三个步骤完成销售订单解析：
1. **文件接收**：获取用户上传的PDF文件URL
2. **自动解析**：调用 @解析客户销售订单@ 工具一键完成OCR、结构化、解析、入库和装箱单生成
3. **结果汇报**：向用户报告处理结果，提供装箱单下载链接

整个流程高度自动化，用户只需上传PDF文件即可完成订单数据录入。
"""

# ────────────────────────────────────────────
# New tool_id for the workstation config
# ────────────────────────────────────────────

NEW_TOOL_ID = 159          # t_gpts_tools.id for the new PaddleOCR-based tool
NEW_TOOL_KEY = 'tool_type_159_8cd42819da39c83a98e3d36c859c381e'
NEW_TOOL_NAME = '解析客户销售订单'
NEW_TOOL_DESC = '解析客户销售订单PDF文件，提取订单数据，生成装箱单'

OLD_TOOL_ID = 158          # the old tool to be replaced in config


with Session(engine) as session:
    # ── 1. Create or update SOP ──
    existing_sop = session.exec(
        text("SELECT id FROM linsight_sop WHERE name = :name LIMIT 1"),
        params={'name': SOP_NAME},
    ).first()

    if existing_sop:
        session.exec(
            text("UPDATE linsight_sop SET content = :content, description = :desc WHERE id = :id"),
            params={'content': SOP_CONTENT, 'desc': SOP_DESCRIPTION, 'id': existing_sop[0]},
        )
        sop_id = existing_sop[0]
        print(f'Updated existing SOP: id={sop_id}')
    else:
        session.exec(
            text(
                "INSERT INTO linsight_sop (name, description, content, user_id, rating, showcase, vector_store_id) "
                "VALUES (:name, :desc, :content, 1, 5, 1, '')"
            ),
            params={'name': SOP_NAME, 'desc': SOP_DESCRIPTION, 'content': SOP_CONTENT},
        )
        sop_id = session.exec(
            text("SELECT id FROM linsight_sop WHERE name = :name ORDER BY id DESC LIMIT 1"),
            params={'name': SOP_NAME},
        ).first()[0]
        print(f'Created new SOP: id={sop_id}')

    # ── 2. Update workstation linsightConfig.tools ──
    ws_row = session.exec(
        text("SELECT value FROM config WHERE `key` = 'workstation' LIMIT 1")
    ).first()

    if ws_row:
        ws_config = json.loads(ws_row[0])
        linsight_cfg = ws_config.get('linsightConfig', {})
        tools = linsight_cfg.get('tools', [])

        updated = False
        for tool_group in tools:
            if tool_group.get('id') == 159:
                children = tool_group.get('children', [])
                # Replace old child with new one, or add new
                new_child = {
                    'id': NEW_TOOL_ID,
                    'name': NEW_TOOL_NAME,
                    'desc': NEW_TOOL_DESC,
                    'tool_key': NEW_TOOL_KEY,
                }
                # Check if new tool already exists
                found = False
                for i, ch in enumerate(children):
                    if ch.get('id') == NEW_TOOL_ID:
                        children[i] = new_child
                        found = True
                        break
                if not found:
                    # Replace old tool if present, otherwise append
                    replaced = False
                    for i, ch in enumerate(children):
                        if ch.get('id') == OLD_TOOL_ID:
                            children[i] = new_child
                            replaced = True
                            break
                    if not replaced:
                        children.append(new_child)
                tool_group['children'] = children
                tool_group['description'] = '客户销售订单解析工作流（PaddleOCR版）'
                updated = True
                break

        if updated:
            linsight_cfg['tools'] = tools
            ws_config['linsightConfig'] = linsight_cfg
            new_value = json.dumps(ws_config, ensure_ascii=False)
            session.exec(
                text("UPDATE config SET value = :val WHERE `key` = 'workstation'"),
                params={'val': new_value},
            )
            print('Updated workstation linsightConfig.tools: replaced old tool with new PaddleOCR tool')
        else:
            print('Warning: tool type 159 not found in linsightConfig.tools, no update made')
    else:
        print('Warning: workstation config not found')

    session.commit()
    print('Done!')
