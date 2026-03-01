import sys, asyncio, json, time
sys.path.insert(0, '/app')

async def test():
    from mep.api.v1.sales_order_process import _call_paddleocr_mcp, _call_llm, STRUCTURE_PROMPT
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
    print('OCR preview:', ocr_text[:200])
    print('---')

    print('Step 2: LLM structuring...')
    prompt = STRUCTURE_PROMPT.format(ocr_text=ocr_text[:15000])
    tables_json = await _call_llm(prompt)
    t2 = time.time()
    if not tables_json:
        print('LLM FAILED')
        return
    tj = tables_json.strip()
    if tj.startswith('```'):
        tj = tj.split('\n', 1)[-1]
        if tj.endswith('```'):
            tj = tj[:-3].strip()
    print('LLM OK:', len(tj), 'chars in', round(t2-t1, 1), 'sec')
    print('---')

    print('Step 3: Parsing...')
    from mep.core.documents.parser import OrderParser
    parser = OrderParser()
    orders = parser.parse(tj)
    t3 = time.time()
    print('Parsed', len(orders), 'orders in', round(t3-t2, 1), 'sec')
    if orders:
        for i, o in enumerate(orders):
            po = o.get('po_number', '?')
            cn = o.get('customer_name', '?')
            nd = len(o.get('details', []))
            print('  Order', i, ': PO=' + str(po), 'customer=' + str(cn), 'details=' + str(nd))
    else:
        print('NO ORDERS - raw tables_json[:300]:')
        print(tj[:300])

    print('Total:', round(t3-t0, 1), 'sec')

asyncio.run(test())
