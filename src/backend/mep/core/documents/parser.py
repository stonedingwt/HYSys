"""
Unified order parser entry point.
Dispatches to customer-specific handlers based on table content,
falls back to the generic handler.
"""

import json
import logging
from typing import Optional, Union

from mep.core.documents.supplier_0978635 import Supplier0978635Handler
from mep.core.documents.supplier_138731 import Supplier138731Handler
from mep.core.documents.generic_handler import GenericFormatHandler

logger = logging.getLogger(__name__)


class OrderParser:
    """
    Parse structured table JSON into sales order dicts.

    Usage:
        parser = OrderParser()
        orders = parser.parse(tables_json, extra_fields={'po_number': '...', 'total_amount': '...'})
    """

    def __init__(self):
        self._handlers = [
            Supplier0978635Handler(),
            Supplier138731Handler(),
        ]
        self._generic = GenericFormatHandler()

    def parse(
        self,
        tables: Union[str, list],
        extra_fields: Optional[dict] = None,
    ) -> list[dict]:
        """Parse tables into a list of order dicts.

        Args:
            tables: either a JSON string or a list of table dicts,
                    each with 'Headers' and 'Rows' keys.
            extra_fields: optional dict with keys like 'po_number',
                          'total_amount', 'total_quantity', 'buying_price'
                          extracted separately (e.g. by LLM from full OCR text).

        Returns:
            A list of order dicts, each containing header info + 'details' list.
        """
        if isinstance(tables, str):
            try:
                tables = json.loads(tables)
            except json.JSONDecodeError:
                logger.error('Failed to parse tables JSON string')
                return []

        if not tables:
            return []

        for handler in self._handlers:
            if handler.is_match(tables):
                logger.info('Matched handler: %s', handler.__class__.__name__)
                return handler.parse(tables, extra_fields)

        logger.info('Using generic handler')
        result = self._generic.parse(tables, extra_fields)
        return [result] if isinstance(result, dict) else result
