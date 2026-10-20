"""API Gateway 向け JSON レスポンスヘルパ。"""

from __future__ import annotations

import json
from typing import Any

CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": (
        "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token"
    ),
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
}


def success(status_code: int, body: Any) -> dict[str, Any]:
    """成功レスポンス（JSON ボディあり）。"""
    return {
        "statusCode": status_code,
        "headers": dict(CORS_HEADERS),
        "body": json.dumps(body, ensure_ascii=False),
    }


def no_content(status_code: int = 204) -> dict[str, Any]:
    """ボディなし成功レスポンス（DELETE 204 等）。"""
    headers = {k: v for k, v in CORS_HEADERS.items() if k != "Content-Type"}
    return {
        "statusCode": status_code,
        "headers": headers,
        "body": "",
    }


def error(status_code: int, message: str) -> dict[str, Any]:
    """エラーレスポンス: { \"message\": \"...\" }。"""
    return {
        "statusCode": status_code,
        "headers": dict(CORS_HEADERS),
        "body": json.dumps({"message": message}, ensure_ascii=False),
    }
