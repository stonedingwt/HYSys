# 销售订单解析规则

## 概述
本文档定义了销售订单 PDF 文件的解析规则。系统通过 PaddleOCR HTTP 服务进行文字识别，然后由 LLM 将 OCR 文本结构化为标准表格 JSON 格式，最后由解析引擎提取订单数据。

## OCR 文本结构化提示词

将 PaddleOCR 输出的文本转换为标准表格 JSON 格式。每个表格对象包含 `Headers`（列名数组）和 `Rows`（行数据二维数组）。

### 结构化要求
1. 识别文档中的所有表格区域
2. 每个表格作为一个独立对象
3. 表头作为 Headers 数组
4. 每行数据作为 Rows 中的一个数组
5. 保持原始数据不做修改
6. 键值对格式的表格保持两列结构

### 输出格式示例
```json
[
  {
    "Headers": ["Supplier", "Date"],
    "Rows": [
      ["Supplier no", "138731"],
      ["Factory", "XXXXX"],
      ["Date", "01.01.2025"]
    ]
  },
  {
    "Headers": ["Position", "Article", "Description", "Order Qty", "Tot.Pieces"],
    "Rows": [
      ["10", "190909001", "Product,Color,XS", "1", "100"],
      ["20", "190909002", "Product,Color,S", "1", "200"]
    ]
  }
]
```

## 客户识别规则

### Supplier 0978635
- 特征：表格 Headers 中包含 "Supplier" 列，某行的 Supplier 值为 "0978635"
- 订单号来源：从全文提取 "PO Nº" 或 "订单号" 字段
- 金额来源：从全文提取 "Gross Amount" 或 "订单总金额" 字段
- 明细标识：Headers 中包含 "Nº Line" 和 "Reference"

### Supplier 138731 (HKM)
- 特征：键值对表格中有行 key="Supplier no"，value="138731"
- 支持多子订单拆分：按 "Supplier" 表头出现次数分组
- 订单号来源：从全文提取 "Ordernumber" 字段
- 金额来源：从全文提取 "Total amount" 字段
- 总件数来源：从全文提取 "Total pieces" 字段
- 明细标识：Headers 中包含 "Position" 和 "Article"

### 通用格式
- 支持键值对格式（两列 key-value 表格）和原始表格格式
- 自动检测格式类型
- 支持单产品和多产品分组

## LLM 全文字段提取提示词

从 OCR 全文中提取以下共享字段，返回 JSON：

```
请从文档中提取以下信息，以JSON格式返回。只返回JSON，不要其他说明文字。

需要提取的字段：
1. po_number: 订单号（Ordernumber/PO Nº 字段的值）
2. total_amount: 订单总金额（Total amount/Gross Amount 字段的值，包含数字和货币单位）
3. total_quantity: 订单总件数（Total pieces/Total Units 字段的值，只提取数字部分）

返回格式：
{"po_number":"xxx","total_amount":"xxx","total_quantity":"xxx"}
```

## 数据映射

### 订单头映射
| 源字段 | 目标字段 | 说明 |
|--------|---------|------|
| po_number | po | 采购订单号 |
| customer_name | customer_name | 客户名称 |
| generic_article_no | generic_article_no | 产品文章编号 |
| total_amount | total_amount | 总金额 |
| total_quantity | total_pieces | 总件数 |
| currency | currency | 币种 |
| issue_date / contract_date | date_of_issue | 开单日期 |
| cargo_delivery_date | cargo_delivery_date | 交货日期 |
| presentation_date | presentation_date | 展示日期 |
| article_description | article_description | 产品描述 |
| delivery_location / delivery_at | delivery_at | 交货地 |
| payment_terms | payment_terms | 付款条件 |
| delivery_terms | delivery_terms | 交货条件 |
| country | country | 国家 |
| brand | brand | 品牌 |
| season | season | 季节 |
| factory | factory | 工厂 |

### 订单明细映射
| 源字段 | 目标字段 | 说明 |
|--------|---------|------|
| article / product_code | article | 产品编号 |
| color | colour | 颜色 |
| size | size | 尺码 |
| quantity | quantity | 数量 |
| total_pieces | tot_pieces | 总件数 |
| unit_price | price_unit_buying | 采购单价 |
| position | position | 行号 |
| description | description | 描述 |
| dc | dc | 配送中心 |
| warehouse | warehouse | 仓库 |
| flow | flow | 流向 |
| destination | destination | 目的地 |
| ean | ean | EAN条码 |
| packing_code | packing_code | 装箱代码 |
