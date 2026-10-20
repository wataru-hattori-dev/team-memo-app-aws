"""DynamoDB アクセス層。"""

from __future__ import annotations

import logging
import os
from typing import Any

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger()


def _table_name() -> str:
    name = os.environ.get("MEMOS_TABLE_NAME")
    if not name:
        raise RuntimeError("MEMOS_TABLE_NAME is not set")
    return name


def get_table():
    """環境変数に従い DynamoDB Table リソースを返す。"""
    endpoint_url = (os.environ.get("DYNAMODB_ENDPOINT_URL") or "").strip() or None
    table_name = _table_name()
    region = (
        os.environ.get("AWS_REGION")
        or os.environ.get("AWS_DEFAULT_REGION")
        or "us-east-1"
    )
    logger.info(
        "dynamodb config table=%s endpoint=%s",
        table_name,
        endpoint_url or "(default AWS)",
    )

    if endpoint_url:
        # DynamoDB Local: セッション・トークンなしの明示クレデンシャルを使う
        session = boto3.session.Session(
            aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID") or "local",
            aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY") or "local",
            region_name=region,
        )
        resource = session.resource("dynamodb", endpoint_url=endpoint_url)
        return resource.Table(table_name)

    resource = boto3.resource("dynamodb", region_name=region)
    return resource.Table(table_name)


def put_memo(item: dict[str, Any]) -> dict[str, Any]:
    """メモを新規作成（PutItem）。同一キー上書きを避けるため attribute_not_exists を付与。"""
    table = get_table()
    try:
        table.put_item(
            Item=item,
            ConditionExpression="attribute_not_exists(memoId)",
        )
    except ClientError as exc:
        error_code = exc.response.get("Error", {}).get("Code", "")
        if error_code == "ConditionalCheckFailedException":
            raise RuntimeError("memo already exists") from exc
        raise
    return item


def list_memos() -> list[dict[str, Any]]:
    """メモ全件を Scan で取得する。0 件は空リスト。"""
    table = get_table()
    items: list[dict[str, Any]] = []
    scan_kwargs: dict[str, Any] = {}
    while True:
        response = table.scan(**scan_kwargs)
        items.extend(response.get("Items") or [])
        last_key = response.get("LastEvaluatedKey")
        if not last_key:
            break
        scan_kwargs["ExclusiveStartKey"] = last_key
    return items


def get_memo(memo_id: str) -> dict[str, Any] | None:
    """memoId で 1 件取得。不存在は None（呼び出し元で 404）。"""
    table = get_table()
    response = table.get_item(Key={"memoId": memo_id})
    item = response.get("Item")
    return item if item else None


def update_memo(
    memo_id: str,
    fields: dict[str, Any],
    *,
    updated_at: str,
) -> dict[str, Any] | None:
    """全置換フィールド + updatedAt。memoId / createdAt は維持。不存在は None。"""
    existing = get_memo(memo_id)
    if existing is None:
        return None

    item = {
        "memoId": memo_id,
        "title": fields["title"],
        "body": fields["body"],
        "author": fields["author"],
        "tags": fields["tags"],
        "createdAt": existing["createdAt"],
        "updatedAt": updated_at,
    }
    table = get_table()
    try:
        table.put_item(
            Item=item,
            ConditionExpression="attribute_exists(memoId)",
        )
    except ClientError as exc:
        error_code = exc.response.get("Error", {}).get("Code", "")
        if error_code == "ConditionalCheckFailedException":
            return None
        raise
    return item
