"""PaddleOCR HTTP server with fast PDF text extraction.

Strategy:
1. For PDFs: try PyMuPDF direct text extraction first (< 1s for 40-page PDFs)
2. Only fall back to OCR if extracted text is insufficient (scanned/image PDFs)
3. For images: always use PaddleOCR

Environment variables throttle CPU usage for OCR fallback.
"""

import os
import sys

os.environ.setdefault('OMP_NUM_THREADS', '4')
os.environ.setdefault('MKL_NUM_THREADS', '4')
os.environ.setdefault('OPENBLAS_NUM_THREADS', '4')
os.environ.setdefault('VECLIB_MAXIMUM_THREADS', '4')
os.environ.setdefault('NUMEXPR_NUM_THREADS', '4')
os.environ.setdefault('FLAGS_paddle_num_threads', '4')
os.environ['PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK'] = 'True'

import logging
import tempfile
import time
import threading
from pathlib import Path

import fitz  # PyMuPDF
from fastapi import FastAPI
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(name)s: %(message)s')
logger = logging.getLogger('paddleocr_http')

app = FastAPI(title='PaddleOCR HTTP Server')

_ocr_engine = None
_engine_lock = threading.Lock()

MIN_CHARS_PER_PAGE = 30


def _get_ocr_engine():
    global _ocr_engine
    if _ocr_engine is not None:
        return _ocr_engine
    with _engine_lock:
        if _ocr_engine is not None:
            return _ocr_engine
        from paddleocr import PaddleOCR
        logger.info('Loading PaddleOCR models (mobile) ...')
        _ocr_engine = PaddleOCR(
            lang='en',
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
        )
        logger.info('PaddleOCR engine ready')
    return _ocr_engine


def _prewarm_engine():
    def _load():
        try:
            engine = _get_ocr_engine()
            from PIL import Image
            tmp = tempfile.NamedTemporaryFile(suffix='.png', delete=False)
            img = Image.new('RGB', (100, 30), color='white')
            img.save(tmp.name)
            try:
                engine.ocr(tmp.name)
            except Exception:
                engine.predict(tmp.name)
            os.unlink(tmp.name)
            logger.info('PaddleOCR pre-warmed OK')
        except Exception as e:
            logger.warning('Pre-warm failed (non-critical): %s', e)
    threading.Thread(target=_load, daemon=True).start()


def _try_pdf_text_extraction(pdf_path: str) -> tuple[str, bool]:
    """Try extracting text directly from PDF using PyMuPDF.

    Returns (text, is_sufficient) where is_sufficient indicates whether
    the extracted text is good enough to skip OCR.
    """
    doc = fitz.open(pdf_path)
    page_count = doc.page_count
    all_text_parts: list[str] = []
    pages_with_text = 0

    for i in range(page_count):
        page_text = doc[i].get_text().strip()
        if page_text:
            all_text_parts.append(f'--- Page {i + 1} ---\n{page_text}')
            if len(page_text) >= MIN_CHARS_PER_PAGE:
                pages_with_text += 1

    doc.close()

    full_text = '\n\n'.join(all_text_parts)
    ratio = pages_with_text / max(page_count, 1)
    is_sufficient = ratio >= 0.5 and len(full_text) > 200

    return full_text, is_sufficient


def _pdf_to_images(pdf_path: str, dpi: int = 100) -> list[str]:
    doc = fitz.open(pdf_path)
    paths = []
    zoom = dpi / 72.0
    mat = fitz.Matrix(zoom, zoom)
    for i, page in enumerate(doc):
        pix = page.get_pixmap(matrix=mat)
        tmp = tempfile.NamedTemporaryFile(suffix=f'_page{i}.png', delete=False)
        pix.save(tmp.name)
        paths.append(tmp.name)
        pix = None
    doc.close()
    return paths


def _extract_text_from_result(result) -> str:
    if not result:
        return ''
    lines: list[str] = []

    if isinstance(result, str):
        return result

    if isinstance(result, (list, tuple)):
        for page_result in result:
            if not page_result:
                continue
            if hasattr(page_result, 'rec_texts'):
                lines.extend(str(t) for t in page_result.rec_texts if t)
                continue
            if isinstance(page_result, dict):
                if 'rec_texts' in page_result:
                    lines.extend(str(t) for t in page_result['rec_texts'] if t)
                    continue
                if 'rec_text' in page_result:
                    lines.extend(str(t) for t in page_result['rec_text'] if t)
                    continue
            if isinstance(page_result, (list, tuple)):
                for line_info in page_result:
                    if isinstance(line_info, dict):
                        t = line_info.get('text') or line_info.get('rec_text', '')
                        if t:
                            lines.append(str(t))
                    elif isinstance(line_info, (list, tuple)) and len(line_info) >= 2:
                        text_part = line_info[1]
                        text = str(text_part[0]) if isinstance(text_part, (list, tuple)) else str(text_part)
                        lines.append(text)

    elif hasattr(result, 'rec_texts'):
        lines.extend(str(t) for t in result.rec_texts if t)
    elif isinstance(result, dict) and 'rec_texts' in result:
        lines.extend(str(t) for t in result['rec_texts'] if t)

    return '\n'.join(lines)


def _ocr_single_image(engine, image_path: str) -> str:
    try:
        result = engine.ocr(image_path)
    except Exception:
        logger.info('ocr() failed, trying predict()')
        result = engine.predict(image_path)
    return _extract_text_from_result(result)


class OcrRequest(BaseModel):
    input_data: str
    output_mode: str = 'simple'


@app.get('/health')
def health():
    return {'status': 'ok', 'engine_loaded': _ocr_engine is not None}


@app.post('/ocr')
def ocr_endpoint(req: OcrRequest):
    t0 = time.time()
    file_path = Path(req.input_data)
    if not file_path.exists():
        return {'error': f'File not found: {req.input_data}'}

    all_text_parts: list[str] = []
    temp_files: list[str] = []
    method = 'unknown'

    try:
        if file_path.suffix.lower() == '.pdf':
            text, sufficient = _try_pdf_text_extraction(str(file_path))
            extract_time = time.time() - t0

            if sufficient:
                method = 'direct_extraction'
                logger.info('PDF text extraction: %d chars in %.2fs (direct, no OCR needed)',
                            len(text), extract_time)
                return {
                    'text': text,
                    'pages': fitz.open(str(file_path)).page_count,
                    'elapsed': round(extract_time, 2),
                    'method': method,
                }

            logger.info('PDF text extraction insufficient (%d chars in %.2fs), falling back to OCR',
                        len(text), extract_time)
            method = 'ocr'
            engine = _get_ocr_engine()
            temp_files = _pdf_to_images(str(file_path), dpi=100)
            logger.info('PDF -> %d page images (%.1fs)', len(temp_files), time.time() - t0)
            for i, img_path in enumerate(temp_files):
                pt = time.time()
                page_text = _ocr_single_image(engine, img_path)
                if page_text:
                    all_text_parts.append(f'--- Page {i + 1} ---\n{page_text}')
                logger.info('  Page %d/%d: %d chars (%.1fs)',
                            i + 1, len(temp_files), len(page_text), time.time() - pt)
        else:
            method = 'ocr'
            engine = _get_ocr_engine()
            page_text = _ocr_single_image(engine, str(file_path))
            if page_text:
                all_text_parts.append(page_text)

        full_text = '\n\n'.join(all_text_parts)
        elapsed = time.time() - t0
        logger.info('Done (%s): %d chars in %.1fs', method, len(full_text), elapsed)

        return {'text': full_text, 'pages': len(temp_files) or 1, 'elapsed': round(elapsed, 1), 'method': method}

    except Exception as e:
        logger.exception('OCR failed')
        return {'error': str(e)}
    finally:
        for tf in temp_files:
            try:
                os.unlink(tf)
            except OSError:
                pass


if __name__ == '__main__':
    import uvicorn
    _prewarm_engine()
    uvicorn.run(app, host='0.0.0.0', port=8400, log_level='info', timeout_keep_alive=900)
