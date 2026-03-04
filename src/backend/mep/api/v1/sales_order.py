import csv
import io
import logging

from fastapi import APIRouter, Query, Request
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel
from typing import Optional

from mep.common.schemas.api import resp_200, resp_500
from mep.database.models.sales_order import SalesOrderDao, SalesOrderHeader, HEADER_FIELDS, LINE_FIELDS, ALL_FIELDS

logger = logging.getLogger(__name__)

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
    'country': 'Country',
    'brand': 'Brand',
    'season': 'Season',
    'factory': 'Factory',
    'source_file_url': 'Source File',
    'markdown_url': 'Markdown',
    'packing_list_url': 'Packing List',
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
    'ean': 'EAN',
    'packing_code': 'Packing Code',
    'sales_organization': 'Sales Organization',
    'business_type': 'Business Type',
    'sales_person': 'Sales Person',
    'product_code': 'Product Code',
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


class ImportOrdersRequest(BaseModel):
    tables_json: str
    extra_fields: Optional[dict] = None
    source_file_url: Optional[str] = None
    markdown_url: Optional[str] = None


@router.post('/import')
async def import_orders(req: ImportOrdersRequest):
    """Parse structured tables JSON and import into database."""
    try:
        from mep.core.documents.parser import OrderParser
        parser = OrderParser()
        orders = parser.parse(req.tables_json, req.extra_fields)
        if not orders:
            return resp_500('No orders parsed from the provided data')

        for order in orders:
            if req.source_file_url:
                order['source_file_url'] = req.source_file_url
            if req.markdown_url:
                order['markdown_url'] = req.markdown_url

        header_ids = await SalesOrderDao.import_orders(orders)
        return resp_200({
            'header_ids': header_ids,
            'count': len(header_ids),
            'message': f'Successfully imported {len(header_ids)} order(s)',
        })
    except Exception as e:
        logger.exception('Failed to import orders')
        return resp_500(str(e))


@router.get('/download')
async def download_order(header_id: int = Query(...)):
    """Download order header + lines as CSV."""
    try:
        header = await SalesOrderDao.get_header(header_id)
        if not header:
            return resp_500('Order not found')
        lines = await SalesOrderDao.get_lines(header_id)

        output = io.StringIO()
        output.write('\ufeff')
        writer = csv.writer(output)

        h_labels = [FIELD_LABELS.get(f, f) for f in HEADER_FIELDS]
        l_labels = [FIELD_LABELS.get(f, f) for f in LINE_FIELDS]
        writer.writerow(h_labels + l_labels)

        hd = header.dict()
        for line in lines:
            ld = line.dict()
            row = []
            for f in HEADER_FIELDS:
                v = hd.get(f)
                row.append('' if v is None else str(v))
            for f in LINE_FIELDS:
                v = ld.get(f)
                row.append('' if v is None else str(v))
            writer.writerow(row)

        if not lines:
            row = ['' if hd.get(f) is None else str(hd.get(f)) for f in HEADER_FIELDS]
            row += ['' for _ in LINE_FIELDS]
            writer.writerow(row)

        output.seek(0)
        filename = f"order_{header.po or header_id}.csv"
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type='text/csv; charset=utf-8',
            headers={'Content-Disposition': f'attachment; filename={filename}'},
        )
    except Exception as e:
        return resp_500(str(e))


@router.get('/packing-list')
async def download_packing_list(header_id: int = Query(...)):
    """Generate and download packing list Excel for an order."""
    try:
        header = await SalesOrderDao.get_header(header_id)
        if not header:
            return resp_500('Order not found')
        lines = await SalesOrderDao.get_lines(header_id)
        if not lines:
            return resp_500('No order lines found')

        order_dict = header.dict()
        lines_dict = [l.dict() for l in lines]
        customer = (order_dict.get('customer_name') or '').upper()

        from mep.core.documents.packing_list import (
            generate_hkm_packing_list,
            generate_generic_packing_list,
        )
        from mep.database.models.packing_spec import PackingSpecDao

        specs = await PackingSpecDao.find_by_customer(customer)
        specs_dict = [s.dict() for s in specs] if specs else []

        if 'HKM' in customer:
            excel_bytes = generate_hkm_packing_list(order_dict, lines_dict, customer_specs=specs_dict)
        else:
            excel_bytes = generate_generic_packing_list(order_dict, lines_dict, customer_specs=specs_dict)

        filename = f"packing_list_{header.po or header_id}.xlsx"
        return Response(
            content=excel_bytes,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers={'Content-Disposition': f'attachment; filename={filename}'},
        )
    except Exception as e:
        logger.exception('Failed to generate packing list')
        return resp_500(str(e))
