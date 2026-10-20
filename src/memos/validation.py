"""リクエスト Body / パスのバリデーション。"""

from __future__ import annotations

import json
from typing import Any


class ValidationError(Exception):
    """クライアント起因の入力エラー。"""

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


_FIELD_LABELS = {
    "title": "タイトル",
    "body": "本文",
    "author": "作成者",
}


def _field_label(field: str) -> str:
    return _FIELD_LABELS.get(field, field)


def parse_json_body(raw_body: str | None) -> dict[str, Any]:
    """JSON Body を dict にパースする。不正 JSON は ValidationError。"""
    if raw_body is None or raw_body.strip() == "":
        raise ValidationError("リクエスト本文が必要です。")
    try:
        data = json.loads(raw_body)
    except json.JSONDecodeError as exc:
        raise ValidationError("リクエストの形式が正しくありません。") from exc
    if not isinstance(data, dict):
        raise ValidationError("リクエストの形式が正しくありません。")
    return data


def _require_trimmed_string(
    data: dict[str, Any],
    field: str,
    *,
    min_len: int,
    max_len: int,
) -> str:
    label = _field_label(field)
    if field not in data or data[field] is None:
        raise ValidationError(f"{label}を入力してください。")
    value = data[field]
    if not isinstance(value, str):
        raise ValidationError(f"{label}の形式が正しくありません。")
    trimmed = value.strip()
    if len(trimmed) < min_len:
        raise ValidationError(f"{label}を入力してください。")
    if len(trimmed) > max_len:
        raise ValidationError(f"{label}は{max_len}文字以内で入力してください。")
    return trimmed


def _validate_tags(data: dict[str, Any]) -> list[str]:
    if "tags" not in data or data["tags"] is None:
        return []
    tags = data["tags"]
    if not isinstance(tags, list):
        raise ValidationError("タグの形式が正しくありません。")
    if len(tags) > 20:
        raise ValidationError("タグは20個以内にしてください。")
    normalized: list[str] = []
    for i, tag in enumerate(tags):
        if not isinstance(tag, str):
            raise ValidationError("タグの形式が正しくありません。")
        trimmed = tag.strip()
        if trimmed == "":
            raise ValidationError("空のタグは使えません。")
        if len(trimmed) > 50:
            raise ValidationError("タグは50文字以内にしてください。")
        normalized.append(trimmed)
    return normalized


def validate_create_memo_body(data: dict[str, Any]) -> dict[str, Any]:
    """POST /memos Body を検証し、正規化済みフィールドを返す。"""
    title = _require_trimmed_string(data, "title", min_len=1, max_len=200)
    body = _require_trimmed_string(data, "body", min_len=1, max_len=10000)
    author = _require_trimmed_string(data, "author", min_len=1, max_len=100)
    tags = _validate_tags(data)
    return {
        "title": title,
        "body": body,
        "author": author,
        "tags": tags,
    }
