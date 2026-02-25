# 赛乐助手 Workflow - Add Nodes (Manual Steps)

If automated login fails, use these manual steps to add nodes in the workflow editor.

**Workflow URL:** https://yuanjing.noooyi.com/flow/3ceb5682fe254a4cadd62118a42a10d7

## Step 1: Login and Open Editor
1. Navigate to https://yuanjing.noooyi.com/
2. Log in (admin / your password)
3. Go to https://yuanjing.noooyi.com/flow/3ceb5682fe254a4cadd62118a42a10d7

## Step 2: Add 输入 (Input) Node
1. In the **left sidebar**, under "基础节点" (Basic Nodes), find **输入**
2. **Drag** the 输入 node onto the canvas, to the **right** of the 开始 (Start) node
3. Drop it when you see the canvas highlight

## Step 3: Add 助手 (Agent) Node
1. In the left sidebar, find **助手**
2. **Drag** it onto the canvas, to the **right** of the 输入 node
3. Drop it

## Step 4: Add 结束 (End) Node
1. In the left sidebar, find **结束**
2. **Drag** it onto the canvas, to the **right** of the 助手 node
3. Drop it

## Step 5: Connect the Nodes
Connect in sequence: **开始 → 输入 → 助手 → 结束**

- Each node has **handles** (small circles) on the left and right
- **开始** (right handle) → drag to **输入** (left handle)
- **输入** (right handle) → drag to **助手** (left handle)
- **助手** (right handle) → drag to **结束** (left handle)

## Step 6: Save
Click **保存** (Save) in the top-right of the editor.

## Expected Final Layout
```
[开始] ----→ [输入] ----→ [助手] ----→ [结束]
```
