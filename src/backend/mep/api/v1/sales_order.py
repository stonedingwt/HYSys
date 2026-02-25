import csv
import io

from fastapi import APIRouter, Query, Request
from fastapi.responses import StreamingResponse

from mep.common.schemas.api import resp_200, resp_500
from mep.database.models.sales_order import SalesOrderDao, HEADER_FIELDS, LINE_FIELDS, ALL_FIELDS

router = APIRouter(prefix='/sales-order', tags=['sales_order'])

FIELD_LABELS = {
    'customer_name': 'Customer name',
    'po': 'PO',
    'generic_article_no': 'Generic article no',
    'total_amount': 'Total amount',
    'total_pieces': 'Total pieces',
    'currency': 'Currency',
    'date_of_issue': 'D.ofissue',
    'cargo_delivery_date': 'Cargo delivery date',
    'presentation_date': 'Presentation date',
    'article_description': 'Article description',
    'delivery_at': 'Delivery At',
    'payment_terms': 'Payment Terms',
    'delivery_terms': 'Delivery Terms',
    'reference': 'Reference',
    'article': 'Article',
    'colour': 'Colour',
    'size': 'Size',
    'quantity': 'Quantity',
    'tot_pieces': 'Tot.Pieces',
    'price_unit_buying': 'PriceUnit Buying',
    'position': 'Position',
    'description': 'Description',
    'dc': 'DC',
    'warehouse': 'Warehouse',
    'flow': 'Flow',
    'destination': 'Destination',
}


def _extract_filters(request: Request) -> dict:
    filters = {}
    for field in HEADER_FIELDS:
        val = request.query_params.get(f'f_{field}', '').strip()
        if val:
            filters[field] = val
    return filters


@router.get('/list')
async def list_headers(
    request: Request,
    page_num: int = Query(1, ge=1),
    page_size: int = Query(15, ge=1, le=100),
    sort_by: str = Query(''),
    sort_order: str = Query('desc'),
):
    try:
        filters = _extract_filters(request)
        items, total = await SalesOrderDao.list_headers(
            filters, page_num, page_size, sort_by, sort_order)
        return resp_200({
            'data': [item.dict() for item in items],
            'total': total,
            'page_num': page_num,
            'page_size': page_size,
        })
    except Exception as e:
        return resp_500(str(e))


@router.get('/lines')
async def get_lines(header_id: int = Query(...)):
    try:
        lines = await SalesOrderDao.get_lines(header_id)
        return resp_200([l.dict() for l in lines])
    except Exception as e:
        return resp_500(str(e))


@router.get('/export')
async def export_items(
    request: Request,
    sort_by: str = Query(''),
    sort_order: str = Query(''),
):
    try:
        filters = _extract_filters(request)
        rows = await SalesOrderDao.list_all_for_export(filters, sort_by, sort_order)

        output = io.StringIO()
        output.write('\ufeff')
        writer = csv.writer(output)

        headers = [FIELD_LABELS.get(f, f) for f in ALL_FIELDS]
        writer.writerow(headers)

        for header, line in rows:
            hd = header.dict()
            ld = line.dict() if line else {}
            row = []
            for f in HEADER_FIELDS:
                v = hd.get(f)
                row.append('' if v is None else str(v))
            for f in LINE_FIELDS:
                v = ld.get(f)
                row.append('' if v is None else str(v))
            writer.writerow(row)

        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type='text/csv; charset=utf-8',
            headers={'Content-Disposition': 'attachment; filename=sales_orders.csv'}
        )
    except Exception as e:
        return resp_500(str(e))


@router.put('/update-header')
async def update_header(data: dict):
    item_id = data.pop('id', None)
    if not item_id:
        return resp_500('Missing id')
    try:
        data.pop('create_time', None)
        data.pop('update_time', None)
        item = await SalesOrderDao.update_header(item_id, data)
        return resp_200(item.dict() if item else None)
    except Exception as e:
        return resp_500(str(e))


@router.put('/update-line')
async def update_line(data: dict):
    item_id = data.pop('id', None)
    if not item_id:
        return resp_500('Missing id')
    try:
        data.pop('create_time', None)
        data.pop('update_time', None)
        data.pop('header_id', None)
        item = await SalesOrderDao.update_line(item_id, data)
        return resp_200(item.dict() if item else None)
    except Exception as e:
        return resp_500(str(e))
