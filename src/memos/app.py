"""メモ CRUD Lambda エントリポイント。"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from repository import list_memos, put_memo, update_memo
from response import error, success
from validation import ValidationError, parse_json_body, validate_create_memo_body

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def _now_iso_utc() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _normalize_path(event: dict[str, Any]) -> str:
    path = event.get("path") or event.get("rawPath") or ""
    # ステージプレフィックス（例: /local/memos）を除去
    stage = (event.get("requestContext") or {}).get("stage")
    if stage and path.startswith(f"/{stage}/"):
        path = path[len(stage) + 1 :]
    if not path.startswith("/"):
        path = f"/{path}"
    return path.rstrip("/") or "/"


def _http_method(event: dict[str, Any]) -> str:
    method = event.get("httpMethod")
    if not method:
        method = (
            (event.get("requestContext") or {})
            .get("http", {})
            .get("method")
        )
    return (method or "").upper()


def _create_memo(event: dict[str, Any]) -> dict[str, Any]:
    raw_body = event.get("body")
    if event.get("isBase64Encoded"):
        import base64

        raw_body = base64.b64decode(raw_body or "").decode("utf-8")

    data = parse_json_body(raw_body)
    fields = validate_create_memo_body(data)
    now = _now_iso_utc()
    item = {
        "memoId": str(uuid.uuid4()),
        "title": fields["title"],
        "body": fields["body"],
        "author": fields["author"],
        "tags": fields["tags"],
        "createdAt": now,
        "updatedAt": now,
    }
    put_memo(item)
    return success(201, item)


def _list_memos(_event: dict[str, Any]) -> dict[str, Any]:
    items = list_memos()
    return success(200, items)


def _extract_memo_id(event: dict[str, Any], path: str) -> str | None:
    """pathParameters または /memos/{memoId} から memoId を取得する。無ければ None。"""
    params = event.get("pathParameters") or {}
    memo_id = params.get("memoId")
    if memo_id is None or str(memo_id).strip() == "":
        prefix = "/memos/"
        if path.startswith(prefix):
            memo_id = path[len(prefix) :]
    if memo_id is None or str(memo_id).strip() == "":
        return None
    memo_id = str(memo_id).strip()
    if "/" in memo_id or memo_id.startswith("{"):
        return None
    return memo_id


def _update_memo(event: dict[str, Any], memo_id: str) -> dict[str, Any]:
    raw_body = event.get("body")
    if event.get("isBase64Encoded"):
        import base64

        raw_body = base64.b64decode(raw_body or "").decode("utf-8")

    data = parse_json_body(raw_body)
    fields = validate_create_memo_body(data)

    updated = update_memo(memo_id, fields, updated_at=_now_iso_utc())
    if updated is None:
        return error(404, "メモが見つかりません。")
    return success(200, updated)


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    method = _http_method(event)
    path = _normalize_path(event)
    memo_id = _extract_memo_id(event, path)

    logger.info(
        "request method=%s path=%s memoId=%s",
        method,
        path,
        memo_id or "-",
    )

    try:
        if method == "POST" and path == "/memos":
            return _create_memo(event)
        if method == "GET" and path == "/memos":
            return _list_memos(event)
        # path が変でも pathParameters.memoId があれば更新として扱う（SAM Local 対策）
        if method == "PUT" and memo_id:
            return _update_memo(event, memo_id)

        if path == "/memos" or path.startswith("/memos/") or memo_id:
            return error(405, "この操作はできません。")
        return error(404, "ページが見つかりません。")
    except ValidationError as exc:
        return error(400, exc.message)
    except Exception:
        logger.exception("unhandled error")
        return error(500, "サーバーでエラーが発生しました。")
