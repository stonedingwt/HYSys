import sys, asyncio, json, time
sys.path.insert(0, '/app')

async def test():
    from mep.api.v1.sales_order_process import (
        _call_paddleocr_mcp, _call_llm, STRUCTURE_PROMPT, EXTRACT_FIELDS_PROMPT,
        _split_ocr_text, _clean_llm_json,
    )
    from mep.core.cache.utils import get_minio_storage

    minio = await get_minio_storage()
    url = await minio.get_share_link('6240067984.pdf', minio.tmp_bucket, clear_host=False)

    t0 = time.time()
    print('Step 1: OCR...')
    ocr_text = await _call_paddleocr_mcp(url)
    t1 = time.time()
    if not ocr_text:
        print('OCR FAILED')
        return
    print('OCR OK:', len(ocr_text), 'chars in', round(t1-t0, 1), 'sec')

    print('Step 2: LLM structuring (chunked)...')
    all_tables = []
    chunks = _split_ocr_text(ocr_text, max_chars=4000)
    print('Split into', len(chunks), 'chunks:', [len(c) for c in chunks])
    for i, chunk in enumerate(chunks):
        print('  Chunk', i+1, '/', len(chunks), '-', len(chunk), 'chars...')
        prompt = STRUCTURE_PROMPT.format(ocr_text=chunk)
        result = await _call_llm(prompt)
        if result:
            cleaned = _clean_llm_json(result)
            try:
                tables = json.loads(cleaned)
                if isinstance(tables, list):
                    all_tables.extend(tables)
                elif isinstance(tables, dict):
                    all_tables.append(tables)
                print('    OK:', len(tables) if isinstance(tables, list) else 1, 'tables')
            except json.JSONDecodeError:
                print('    JSON parse failed')
                print('    Raw:', cleaned[:200])
        else:
            print('    LLM returned None')
    t2 = time.time()
    print('LLM structuring:', len(all_tables), 'tables in', round(t2-t1, 1), 'sec')

    if not all_tables:
        print('NO TABLES EXTRACTED')
        return

    print('Step 3: Extract fields...')
    extract_prompt = EXTRACT_FIELDS_PROMPT.format(ocr_text=ocr_text[:3000])
    fields_str = await _call_llm(extract_prompt)
    t3 = time.time()
    extra_fields = {}
    if fields_str:
        fs = fields_str.strip()
        if fs.startswith('```'):
            fs = fs.split('\n', 1)[-1]
            if fs.endswith('```'):
                fs = fs[:-3].strip()
        start = fs.find('{')
        end = fs.rfind('}')
        if start != -1 and end != -1:
            extra_fields = json.loads(fs[start:end+1])
    print('Fields:', extra_fields, 'in', round(t3-t2, 1), 'sec')

    print('Step 4: Parse orders...')
    tables_json_str = json.dumps(all_tables, ensure_ascii=False)
    from mep.core.documents.parser import OrderParser
    parser = OrderParser()
    orders = parser.parse(tables_json_str, extra_fields)
    t4 = time.time()
    print('Parsed', len(orders), 'orders in', round(t4-t3, 1), 'sec')

    if orders:
        for i, o in enumerate(orders):
            po = o.get('po_number', '?')
            cn = o.get('customer_name', '?')
            nd = len(o.get('details', []))
            print('  Order', i, ': PO=' + str(po), 'customer=' + str(cn), 'details=' + str(nd))
        print('SUCCESS!')
    else:
        print('NO ORDERS parsed')

    print('Total time:', round(t4-t0, 1), 'sec')

asyncio.run(test())
