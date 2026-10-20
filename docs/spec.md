# 基本仕様書（spec.md）

| 項目 | 内容 |
|------|------|
| ドキュメント | 基本仕様書 |
| 対象アプリ | team-memo-app-aws（チーム共有メモアプリ） |
| 入力 | `template.yaml`, `AGENTS.md` |
| ドキュメントステップ | 1 / 5（次: `docs/要件定義書.md`） |
| ステータス | 確定（IaC・構成の基本仕様） |

---

## 1. 目的

本ドキュメントは、`template.yaml` と `AGENTS.md` を正本入力とし、チーム共有メモアプリの **システム構成・API・データモデル・ローカル開発前提** を固定する。

以降の要件定義・計画・実装は、本仕様との矛盾がない形で進める。

---

## 2. システム概要

チーム内でメモ（タイトル・本文・作成者・タグ等）を共有し、作成・一覧・更新・削除を行う Web アプリケーション。

| 層 | 技術 |
|----|------|
| フロントエンド | React + TypeScript (Vite) + Tailwind CSS |
| API | Amazon API Gateway（REST API / SAM `AWS::Serverless::Api`） |
| コンピュート | AWS Lambda（Python 3.11）、単一関数で CRUD を処理 |
| データストア | Amazon DynamoDB（ローカルは DynamoDB Local） |
| IaC | AWS SAM（ルートの `template.yaml`） |

開発方針は **ローカル完結を最優先** とする。フロント + SAM Local + DynamoDB Local による E2E 合格まで、実 AWS へのデプロイは行わない。

---

## 3. アーキテクチャ

```text
[ブラウザ]
    │  Vite dev server (http://localhost:5173)
    │  VITE_API_BASE_URL → SAM Local API
    ▼
[API Gateway / SAM Local]  Path: /memos, /memos/{memoId}
    │  CORS: localhost フロントからの呼び出しを許可
    ▼
[Lambda: MemosFunction]  Handler: app.lambda_handler  Runtime: python3.11
    │  環境変数 MEMOS_TABLE_NAME / STAGE_NAME
    │  ローカル時: DYNAMODB_ENDPOINT_URL → DynamoDB Local
    ▼
[DynamoDB: MemosTable]  PK: memoId (S)
```

### 3.1 論理コンポーネント

| 論理 ID | 種別 | 役割 |
|---------|------|------|
| `MemosApi` | `AWS::Serverless::Api` | REST API。ステージ名・CORS を明示制御 |
| `MemosFunction` | `AWS::Serverless::Function` | メモ CRUD。`CodeUri: src/memos/` |
| `MemosTable` | `AWS::DynamoDB::Table` | メモ本体の永続化 |

### 3.2 パラメータ

| パラメータ | 型 | 既定値 | 説明 |
|------------|-----|--------|------|
| `StageName` | String | `local` | API Gateway ステージ名。許可値: `local` / `dev` / `prod` |

リソース名はステージを含む（例: `team-memo-app-memos-${StageName}`）。

---

## 4. ディレクトリ構成（ルート配置型）

```text
team-memo-app-aws/
├── AGENTS.md                 # エージェント／開発規約
├── template.yaml             # AWS SAM テンプレート（正本・ルート固定）
├── samconfig.toml            # SAM CLI 設定（必要時）
├── README.md
├── docs/                     # 階層型ドキュメント
│   └── spec.md               # 本ファイル
├── src/
│   └── memos/                # Lambda ソース（CodeUri と一致）
│       ├── app.py            # lambda_handler
│       └── requirements.txt  # 必要時
├── frontend/                 # React + TypeScript (Vite) + Tailwind
│   └── src/
│       ├── api/              # API クライアント集約
│       ├── components/
│       └── types/
├── events/                   # sam local invoke 用イベント
├── tests/                    # バックエンドテスト
```

起動・ビルド手順の正本は `docs/build.md`。

### 配置ルール

1. `template.yaml` はリポジトリルート固定。
2. Lambda コードは `src/` 配下。`CodeUri` とパスを一致させる。
3. フロントは `frontend/` に完結。ルートの `package.json` でフロントを管理しない。
4. 仕様・計画ドキュメントは `docs/` に置く。
5. フロントとバックのコード混在は禁止。共有が必要なら `src/common/` または Lambda Layer を検討する。

---

## 5. AWS リソース仕様（template.yaml）

### 5.1 Globals（Lambda）

| 項目 | 値 |
|------|-----|
| Runtime | `python3.11` |
| Architectures | `x86_64` |
| Timeout | 15 秒 |
| MemorySize | 256 MB |
| Tracing | Active（X-Ray） |
| 環境変数 | `MEMOS_TABLE_NAME` = `!Ref MemosTable`、`STAGE_NAME` = `!Ref StageName` |

### 5.2 Globals / API CORS

| 項目 | 値 |
|------|-----|
| AllowMethods | `GET,POST,PUT,DELETE,OPTIONS` |
| AllowHeaders | `Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token` |
| AllowOrigin | `*`（ローカル Vite からの呼び出しを想定） |
| MaxAge | `600` |

同一 CORS 設定を `Globals.Api` と `MemosApi` の両方に定義する。

### 5.3 MemosTable

| 項目 | 値 |
|------|-----|
| 論理 ID | `MemosTable` |
| テーブル名 | `team-memo-app-memos-${StageName}` |
| BillingMode | `PAY_PER_REQUEST` |
| パーティションキー | `memoId` (String) / HASH |
| ソートキー | なし |
| GSI / LSI | なし（本仕様時点） |
| Tags | `Application=team-memo-app-aws`, `Stage=${StageName}` |

### 5.4 MemosFunction

| 項目 | 値 |
|------|-----|
| 論理 ID | `MemosFunction` |
| 関数名 | `team-memo-app-memos-${StageName}` |
| CodeUri | `src/memos/` |
| Handler | `app.lambda_handler` |
| IAM | `DynamoDBCrudPolicy`（対象: `MemosTable`） |

### 5.5 MemosApi

| 項目 | 値 |
|------|-----|
| 論理 ID | `MemosApi` |
| 名前 | `team-memo-app-api-${StageName}` |
| StageName | `!Ref StageName` |
| 種別 | REST API（SAM `AWS::Serverless::Api`） |

### 5.6 Outputs

| 出力名 | 内容 |
|--------|------|
| `MemosApiUrl` | `https://${MemosApi}.execute-api.${AWS::Region}.amazonaws.com/${StageName}`（末尾に `/memos` を付けて利用） |
| `MemosApiId` | API Gateway REST API ID |
| `MemosTableName` | DynamoDB テーブル名 |
| `MemosFunctionArn` | Lambda ARN |
| `LocalDevHint` | ローカル開発ヒント（デプロイ成果物ではない） |

---

## 6. API 仕様

単一 Lambda が API Gateway プロキシ統合イベントを受け、HTTP メソッド・パスで処理を分岐する。レスポンスは JSON。`Content-Type: application/json` と適切な HTTP ステータスを返す。

### 6.1 エンドポイント一覧

| 操作 | メソッド | パス | API イベント名 | 概要 |
|------|----------|------|----------------|------|
| 作成 | `POST` | `/memos` | `CreateMemo` | メモ新規作成 |
| 一覧 | `GET` | `/memos` | `ListMemos` | メモ一覧取得 |
| 更新 | `PUT` | `/memos/{memoId}` | `UpdateMemo` | 指定メモの更新 |
| 削除 | `DELETE` | `/memos/{memoId}` | `DeleteMemo` | 指定メモの削除 |

パスパラメータ `memoId` は DynamoDB のパーティションキーと一致する。

### 6.2 リクエスト／レスポンス（基本仕様レベル）

詳細なバリデーション規則・エラーコード体系は次ステップ（要件定義書）で確定する。本仕様ではフィールド方針を固定する。

#### 共通レスポンス方針

- 成功時: 対象リソースまたは一覧を JSON で返す。
- クライアントエラー: 4xx とエラーメッセージ（JSON）。
- サーバエラー: 5xx とエラーメッセージ（JSON）。例外は握りつぶさない。

#### POST `/memos`（作成）

| 項目 | 方針 |
|------|------|
| Body（想定） | `title`, `body`（本文）, `author`（作成者名）, `tags`（配列、任意） |
| サーバ生成 | `memoId`（一意 ID）, `createdAt`, `updatedAt` |
| 成功 | `201 Created`（または同等）と作成済みメモ |

#### GET `/memos`（一覧）

| 項目 | 方針 |
|------|------|
| Query | 本仕様時点では未定義（全件一覧を基本）。フィルタ・ページングは要件定義で要否を決める |
| 成功 | `200 OK` とメモ配列 |

#### PUT `/memos/{memoId}`（更新）

| 項目 | 方針 |
|------|------|
| Path | `memoId`（必須） |
| Body（想定） | 更新対象フィールド（少なくとも `title`, `body`, `author`, `tags`） |
| サーバ更新 | `updatedAt` |
| 成功 | `200 OK` と更新後メモ |
| 不存在 | `404 Not Found` |

#### DELETE `/memos/{memoId}`（削除）

| 項目 | 方針 |
|------|------|
| Path | `memoId`（必須） |
| 成功 | `204 No Content` または削除結果 JSON |
| 不存在 | `404 Not Found` |

### 6.3 CORS / OPTIONS

API Gateway 側で CORS を設定する。フロント（Vite: `http://localhost:5173` 等）からのクロスオリジン呼び出しを想定する。

---

## 7. データモデル

### 7.1 キー設計（IaC 確定）

| 属性 | 型 | 役割 |
|------|-----|------|
| `memoId` | String (S) | パーティションキー（HASH）。メモの一意 ID |

ソートキー・GSI は本仕様時点では定義しない。一覧はテーブルスキャンまたは同等の取得手段を前提とし、規模拡大時のクエリ最適化は後続ステップで再検討する。

### 7.2 属性（アプリ仕様方針）

`template.yaml` はキーのみ定義する。アプリ層で扱う属性の方針は次のとおり。

| 属性 | 型（論理） | 必須 | 説明 |
|------|------------|------|------|
| `memoId` | string | はい | 一意 ID（作成時にサーバ生成） |
| `title` | string | はい | タイトル |
| `body` | string | はい | 本文 |
| `author` | string | はい | 作成者／名前 |
| `tags` | string[] | いいえ | タグ／カテゴリ |
| `createdAt` | string (ISO 8601) | はい | 作成日時 |
| `updatedAt` | string (ISO 8601) | はい | 更新日時 |

属性名・必須可否・最大長などの厳密なバリデーションは `docs/要件定義書.md` で確定する。

### 7.3 アイテム例

```json
{
  "memoId": "550e8400-e29b-41d4-a716-446655440000",
  "title": "スプリント振り返り",
  "body": "今週の決定事項を共有する。",
  "author": "yamada",
  "tags": ["sprint", "shared"],
  "createdAt": "2026-04-01T10:00:00Z",
  "updatedAt": "2026-04-01T10:00:00Z"
}
```

---

## 8. バックエンド実装方針

| 項目 | 仕様 |
|------|------|
| 言語 / ランタイム | Python 3.11（`template.yaml` Globals と一致） |
| エントリポイント | `src/memos/app.py` の `lambda_handler` |
| ルーティング | API Gateway イベントの HTTP メソッド・パスで分岐 |
| DynamoDB アクセス | 環境変数 `MEMOS_TABLE_NAME` を参照（テーブル名ハードコード禁止） |
| ローカル DB | 環境変数 `DYNAMODB_ENDPOINT_URL`（例: `http://host.docker.internal:8000`）で DynamoDB Local を指定 |
| IAM（実環境） | `DynamoDBCrudPolicy` により CRUD を許可 |
| 文字コード | UTF-8 |

---

## 9. フロントエンド仕様方針

| 項目 | 仕様 |
|------|------|
| スタック | React + TypeScript (Vite) + Tailwind CSS |
| 配置 | `frontend/` 配下に完結 |
| TypeScript | `strict` を維持 |
| API 呼び出し | `frontend/src/api/` に集約。コンポーネントから URL を散在させない |
| API ベース URL | 環境変数 `VITE_API_BASE_URL`。既定は SAM Local（`http://127.0.0.1:3000` 等） |
| UI | Tailwind CSS。新規の巨大 CSS フレームワークは追加しない |
| 画面機能（方針） | メモ一覧表示、新規作成、編集、削除 |

画面ワイヤー・コンポーネント分解は要件定義・実装計画で詳細化する。

---

## 10. ローカル開発仕様

### 10.1 推奨構成

| コンポーネント | 起動 | ポート（目安） |
|----------------|------|----------------|
| DynamoDB Local | Docker 等 | `8000` |
| SAM Local API | `sam local start-api` | `3000` |
| Vite (React) | `npm run dev`（`frontend/`） | `5173` |

### 10.2 検証ルール

| ルール | 内容 |
|--------|------|
| API 検証 | `sam local start-api` で実施 |
| DB 検証 | DynamoDB Local を使用。開発中に実アカウントの DynamoDB を触らない |
| フロント検証 | Vite から SAM Local API を呼び出す |
| デプロイ | ローカル E2E 合格まで `sam deploy` / 実 CloudFormation デプロイ禁止 |

### 10.3 ローカル環境変数（方針）

| 変数 | 用途 |
|------|------|
| `MEMOS_TABLE_NAME` | DynamoDB テーブル名（SAM / env-vars で注入） |
| `STAGE_NAME` | ステージ名 |
| `DYNAMODB_ENDPOINT_URL` | DynamoDB Local エンドポイント（SAM Local の `--env-vars` 等） |
| `VITE_API_BASE_URL` | フロントから見た API ベース URL |

秘密情報（AWS キー等）はリポジトリにコミットしない。ローカル用は `.env` / `.env.local`（gitignore 対象）を使用する。

---

## 11. 非機能・制約（基本）

| 区分 | 内容 |
|------|------|
| 可用性・性能の数値目標 | 本仕様では未定義。要件定義書で必要に応じ定義 |
| 認証・認可 | 本仕様時点の `template.yaml` には Authorizer なし。要否は要件定義で決定 |
| 観測性 | Lambda Tracing Active（X-Ray）。詳細なログ設計は後続 |
| セキュリティ | 秘密情報のリポジトリ混入禁止。CORS は開発向けに `AllowOrigin: *` |
| IaC | ARN / アカウント ID のハードコード禁止。`!Ref` / `!GetAtt` / `!Sub` を使用 |
| 文字コード / 改行 | UTF-8。改行は既存方針に合わせる（Windows でも LF 推奨） |

---

## 12. スコープ外（本仕様時点）

次は基本仕様の対象外とし、要件定義以降で要否を判断する。

- ユーザー認証（Cognito / JWT 等）
- メモの全文検索・高度なタグ検索用 GSI
- 添付ファイル・画像アップロード
- リアルタイム同期（WebSocket 等）
- 実 AWS へのデプロイ手順の詳細（`docs/build.md` で扱う）
- CI/CD パイプライン

---

## 13. トレーサビリティ

| 本仕様の根拠 | 参照 |
|--------------|------|
| アプリ概要・API 方針・ディレクトリ・ローカル優先 | `AGENTS.md` |
| API パス／メソッド、DynamoDB PK、Lambda、CORS、Outputs | `template.yaml` |

仕様変更時は本ファイルを更新し、下流（要件定義書 → plan → 実装計画書 → build）との矛盾を残さない。`template.yaml` の API / リソース変更時は、少なくとも本 `spec.md` への反映を検討する。

---

## 14. 次アクション

1. 本仕様を入力に `docs/要件定義書.md` を作成する（機能・非機能・受け入れ条件）。
2. 要件定義完了後、`docs/plan.md` → `docs/実装計画書.md` の順で進める。
3. ステップ 4（実装計画）完了前の本実装は原則行わない。
`)