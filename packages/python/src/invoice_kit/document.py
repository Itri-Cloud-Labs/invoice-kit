from __future__ import annotations

import json
from dataclasses import fields, is_dataclass
from datetime import date, datetime
from enum import Enum
from pathlib import Path
from typing import Any, cast

from .models import BusinessDocumentData, PdfFonts, PdfSpacing


def _serialize(value: Any) -> Any:
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if is_dataclass(value) and not isinstance(value, type):
        return {
            item.name: _serialize(member)
            for item in fields(value)
            if (member := getattr(value, item.name)) is not None
        }
    if isinstance(value, list):
        return [_serialize(item) for item in value]
    return value


class BusinessDocument:
    def __init__(self, data: BusinessDocumentData) -> None:
        self._data = data

    @property
    def data(self) -> BusinessDocumentData:
        return self._data

    def to_dict(self) -> dict[str, object]:
        return cast(dict[str, object], _serialize(self._data))

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), ensure_ascii=False, separators=(",", ":"))

    def to_pdf(
        self,
        output_path: str | Path | None = None,
        *,
        fonts: PdfFonts | None = None,
        spacing: PdfSpacing | None = None,
    ) -> bytes:
        from .pdf import render_document_pdf

        output = render_document_pdf(self._data, fonts=fonts, spacing=spacing)
        if output_path is not None:
            Path(output_path).write_bytes(output)
        return output
