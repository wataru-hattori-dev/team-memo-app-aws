"""POST /memos Body バリデーションの単体テスト（必須欠落・長すぎ）。"""

from __future__ import annotations

import pytest

from validation import ValidationError, validate_create_memo_body


def _valid_payload(**overrides: object) -> dict:
    data: dict = {
        "title": "スプリント振り返り",
        "body": "今週の決定事項を共有する。",
        "author": "yamada",
        "tags": ["sprint"],
    }
    data.update(overrides)
    return data


def test_validate_create_memo_body_success() -> None:
    result = validate_create_memo_body(_valid_payload())
    assert result["title"] == "スプリント振り返り"
    assert result["body"] == "今週の決定事項を共有する。"
    assert result["author"] == "yamada"
    assert result["tags"] == ["sprint"]


@pytest.mark.parametrize(
    ("field", "label"),
    [
        ("title", "タイトル"),
        ("body", "本文"),
        ("author", "作成者"),
    ],
)
def test_required_field_missing(field: str, label: str) -> None:
    data = _valid_payload()
    del data[field]
    with pytest.raises(ValidationError, match=f"{label}を入力してください"):
        validate_create_memo_body(data)


@pytest.mark.parametrize(
    ("field", "label"),
    [
        ("title", "タイトル"),
        ("body", "本文"),
        ("author", "作成者"),
    ],
)
def test_required_field_empty_or_whitespace(field: str, label: str) -> None:
    data = _valid_payload(**{field: "   "})
    with pytest.raises(ValidationError, match=f"{label}を入力してください"):
        validate_create_memo_body(data)


@pytest.mark.parametrize(
    ("field", "label", "max_len"),
    [
        ("title", "タイトル", 200),
        ("body", "本文", 10000),
        ("author", "作成者", 100),
    ],
)
def test_field_too_long(field: str, label: str, max_len: int) -> None:
    data = _valid_payload(**{field: "a" * (max_len + 1)})
    with pytest.raises(
        ValidationError,
        match=f"{label}は{max_len}文字以内で入力してください",
    ):
        validate_create_memo_body(data)


@pytest.mark.parametrize(
    ("field", "max_len"),
    [
        ("title", 200),
        ("body", 10000),
        ("author", 100),
    ],
)
def test_field_at_max_length_ok(field: str, max_len: int) -> None:
    result = validate_create_memo_body(_valid_payload(**{field: "a" * max_len}))
    assert result[field] == "a" * max_len
