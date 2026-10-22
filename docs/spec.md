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

チーム内でメモ（タイトル・本文・作成者）を共有し、作成・一覧・更新・削除を行う Web アプリケーション。

| 層 | 技術 |
|----|------|
| フロントエンド | React + TypeScript (Vite) + Tailwind CSS |
| 画面の配信（実環境） | 非公開 Amazon S3 + Amazon CloudFront（OAC、HTTPS） |
| API | Amazon API Gateway（REST API / SAM `AWS::Serverless::Api`） |
| コンピュート | AWS Lambda（Python 3.11）、単一関数で CRUD を処理 |
| データストア | Amazon DynamoDB（ローカルは DynamoDB Local） |
| IaC | AWS SAM（ルートの `template.yaml`） |

開発方針は **ローカル完結を最優先** とする。フロント + SAM Local + DynamoDB Local による E2E 合格まで、実 AWS へのデプロイは行わない。合格後のデプロイ手順は `docs/build.md` §8。

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

実環境の画面配信（API 本体は上と同じ Lambda / DynamoDB。認証は付けない）:

```text
[ブラウザ]  https://xxxx.cloudfront.net
    │  HTTPS のみ。DefaultRootObject: index.html
    ▼
[CloudFront: FrontendDistribution]  OAC
    │  バケットのパブリックアクセスはすべてブロック
    ▼
[S3: FrontendBucket]  非公開。Vite の frontend/dist を配置
    │
    │  画面の API 呼び出し（ビルド時の VITE_API_BASE_URL）
    ▼
[API Gateway]  CORS はパラメータ CorsAllowOrigin
    │  デプロイ直後の既定は *。手順に従い CloudFront の URL のみに絞る
    ▼
[Lambda: MemosFunction] → [DynamoDB: MemosTable]
```

### 3.1 論理コンポーネント

| 論理 ID | 種別 | 役割 |
|---------|------|------|
| `MemosApi` | `AWS::Serverless::Api` | REST API。ステージ名・CORS を明示制御 |
| `MemosFunction` | `AWS::Serverless::Function` | メモ CRUD。`CodeUri: src/memos/` |
| `MemosTable` | `AWS::DynamoDB::Table` | メモ本体の永続化 |
| `FrontendBucket` | `AWS::S3::Bucket` | 画面ファイル。パブリックアクセスはすべてブロック |
| `FrontendOriginAccessControl` | `AWS::CloudFront::OriginAccessControl` | S3 への署名付き読み取り（OAC） |
| `FrontendDistribution` | `AWS::CloudFront::Distribution` | HTTPS 配信。`DefaultRootObject: index.html` |
| `FrontendBucketPolicy` | `AWS::S3::BucketPolicy` | 当該 CloudFront ディストリビューションからの `s3:GetObject` のみ許可 |

### 3.2 パラメータ

| パラメータ | 型 | 既定値 | 説明 |
|------------|-----|--------|------|
| `StageName` | String | `local` | API Gateway ステージ名。許可値: `local` / `dev` / `prod` |
| `CorsAllowOrigin` | String | `*` | CORS の許可オリジン。引用符なし。`*` または `https://ホスト`（末尾スラッシュなし） |

リソース名はステージを含む（例: `team-memo-app-memos-${StageName}`）。`sam local` はテンプレート既定（`StageName=local`、`CorsAllowOrigin=*`）を使う。実デプロイの `samconfig.toml` は `StageName=dev` を渡す。

---

## 4. ディレクトリ構成（ルート配置型）

```text
team-memo-app-aws/
├── AGENTS.md                 # エージェント／開発規約
├── template.yaml             # AWS SAM テンプレート（正本・ルート固定）
├── samconfig.toml            # sam deploy の設定（秘密情報なし。コミットする）
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
| AllowOrigin | パラメータ `CorsAllowOrigin`。既定は `*`（ローカル Vite 向け）。実環境では CloudFront の URL のみ |
| MaxAge | `600` |

同一 CORS 設定を `Globals.Api` と `MemosApi` の両方に定義する。値は `!Sub "'${CorsAllowOrigin}'"` とし、API Gateway が要求する単一引用符付きの形にする。

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
| `FrontendUrl` | `https://${FrontendDistribution.DomainName}` |
| `FrontendBucketName` | 画面ファイル用の非公開バケット名 |
| `FrontendDistributionId` | CloudFront ディストリビューション ID |
| `LocalDevHint` | ローカル開発ヒント（デプロイ成果物ではない） |

### 5.7 画面の配信（FrontendBucket / CloudFront）

| 項目 | 値 |
|------|-----|
| バケット | パブリックアクセスブロックは 4 項目とも有効。ACL は `BucketOwnerEnforced`。暗号化は SSE-S3（AES256） |
| 公開ウェブサイト設定 | 使わない |
| 読み取り経路 | CloudFront OAC（`SigningBehavior: always`、`sigv4`） |
| バケットポリシー | プリンシパル `cloudfront.amazonaws.com`、`s3:GetObject`、条件 `AWS:SourceArn` がそのディストリビューション |
| ビューア | `ViewerProtocolPolicy: redirect-to-https`。証明書は CloudFront 既定（`*.cloudfront.net`） |
| 既定オブジェクト | `index.html` |
| キャッシュ | AWS 管理ポリシー CachingOptimized。更新時は無効化（手順は `docs/build.md` §8） |
| PriceClass | `PriceClass_200`（東京リージョンのエッジを含む） |
| 配置する中身 | `frontend/` で `npm run build` した `frontend/dist`。ビルド時に `VITE_API_BASE_URL` へ `MemosApiUrl` を渡す |

カスタムドメイン、Cognito、CI/CD は本仕様に含めない。

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

JSON 入出力例の正本は本節。文字数などのバリデーション数値は `docs/実装計画書.md` §1.4。

#### 共通レスポンス方針

- 成功時: 対象リソースまたは一覧を JSON で返す。メモ 1 件の形は §7.3。
- クライアントエラー: 4xx と `{ "message": "<string>" }`。
- サーバエラー: 5xx と `{ "message": "<string>" }`。例外は握りつぶさない。
- 日時は ISO 8601 UTC（末尾 `Z`）。

#### POST `/memos`（作成）

| 項目 | 方針 |
|------|------|
| Body（想定） | `title`, `body`（本文）, `author`（作成者名） |
| サーバ生成 | `memoId`（一意 ID）, `createdAt`, `updatedAt` |
| 成功 | `201 Created` と作成済みメモ |

#### GET `/memos`（一覧）

| 項目 | 方針 |
|------|------|
| Query | 本仕様時点では未定義（全件一覧を基本）。フィルタ・ページングは要件定義で要否を決める |
| 成功 | `200 OK` とメモ配列。0 件は `[]` |

#### PUT `/memos/{memoId}`（更新）

| 項目 | 方針 |
|------|------|
| Path | `memoId`（必須） |
| Body（想定） | `title`, `body`, `author` 必須の全置換 |
| サーバ更新 | `updatedAt` のみ。`memoId` / `createdAt` は維持 |
| 成功 | `200 OK` と更新後メモ |
| 不存在 | `404 Not Found` |

#### DELETE `/memos/{memoId}`（削除）

| 項目 | 方針 |
|------|------|
| Path | `memoId`（必須） |
| 成功 | `204 No Content`（ボディなし） |
| 不存在 | `404 Not Found` |

#### 入出力例

**POST `/memos`**

Request:

```json
{
  "title": "スプリント振り返り",
  "body": "今週の決定事項を共有する。",
  "author": "yamada"
}
```

Response `201`: §7.3 のアイテム例と同じ。`memoId` / `createdAt` / `updatedAt` はサーバ生成。作成直後は `createdAt` と `updatedAt` が同一時刻。

Error `400`: `{ "message": "title is required" }` 等（文言は実装で統一）。

**GET `/memos`**

ボディなし。成功 `200`。要素の形は §7.3。0 件は次のとおり。

```json
[]
```

**PUT `/memos/{memoId}`**

Request:

```json
{
  "title": "更新後タイトル",
  "body": "更新後本文",
  "author": "yamada"
}
```

Response `200` は更新後のフルメモ。`updatedAt` は新しい時刻。`createdAt` は作成時のまま。

```json
{
  "memoId": "550e8400-e29b-41d4-a716-446655440000",
  "title": "更新後タイトル",
  "body": "更新後本文",
  "author": "yamada",
  "createdAt": "2026-04-01T10:00:00Z",
  "updatedAt": "2026-04-02T09:30:00Z"
}
```

不存在は `404` と `{ "message": "<string>" }`。

**DELETE `/memos/{memoId}`**

ボディなし。成功 `204`（ボディなし）。不存在は `404` と `{ "message": "<string>" }`。

### 6.3 CORS / OPTIONS

API Gateway 側で CORS を設定する。ローカルは Vite（`http://localhost:5173`）から SAM Local を呼ぶため、`CorsAllowOrigin` の既定は `*`。実環境の画面は CloudFront の別オリジンから API Gateway を呼ぶ。初回デプロイ後、`CorsAllowOrigin` を `FrontendUrl` に合わせて再デプロイする。手順は `docs/build.md` §8。

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
| API ベース URL | 環境変数 `VITE_API_BASE_URL`。開発時の既定は SAM Local（`http://127.0.0.1:3000`）。実環境向けビルドでは `MemosApiUrl`（`/memos` は付けない）を渡す。Vite はビルド時にこの値を埋め込む |
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
| デプロイ | ローカル E2E 合格まで `sam deploy` / 実 CloudFormation デプロイ禁止。合格後は `docs/build.md` §8 |

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
| セキュリティ | 秘密情報のリポジトリ混入禁止。画面バケットは非公開で、配信は CloudFront（HTTPS、OAC）のみ。CORS の既定は開発向け `*`。実環境では CloudFront の URL に絞る。API の認証は無し |
| IaC | ARN / アカウント ID のハードコード禁止。`!Ref` / `!GetAtt` / `!Sub` を使用 |
| 文字コード / 改行 | UTF-8。改行は既存方針に合わせる（Windows でも LF 推奨） |

---

## 12. スコープ外（本仕様時点）

次は基本仕様の対象外とし、要件定義以降で要否を判断する。

- ユーザー認証（Cognito / JWT 等）
- メモの全文検索用 GSI
- 添付ファイル・画像アップロード
- リアルタイム同期（WebSocket 等）
- CI/CD パイプライン
- カスタムドメイン（画面は `*.cloudfront.net`、API は execute-api の URL）

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