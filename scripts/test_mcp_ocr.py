import sys, asyncio, json, time
sys.path.insert(0, '/app')

async def test():
    from mep.api.v1.sales_order_process import _call_paddleocr_mcp
    from mep.core.cache.utils import get_minio_storage

    minio = await get_minio_storage()
    url = await minio.get_share_link('6240067984.pdf', minio.tmp_bucket, clear_host=False)

    t0 = time.time()
    print('Calling OCR via MCP (with file download)...')
    ocr_text = await _call_paddleocr_mcp(url)
    t1 = time.time()

    if ocr_text:
        print('OCR OK:', len(ocr_text), 'chars in', round(t1-t0, 1), 'sec')
        print('Preview:', ocr_text[:300])
    else:
        print('OCR FAILED in', round(t1-t0, 1), 'sec')

asyncio.run(test())
