# AGENTS.md — team-memo-app-aws

本ドキュメントは、本リポジトリで作業する AI エージェントおよび開発者向けの **プロジェクト規約・作業フローの正本** です。  
実装・レビュー・ドキュメント作成の前に必ず参照してください。

---

## 1. プロジェクト概要

| 項目 | 内容 |
|------|------|
| アプリ名 | チーム共有メモアプリ（team-memo-app-aws） |
| フロントエンド | React + TypeScript (Vite) + Tailwind CSS |
| バックエンド | AWS SAM / Lambda（Python 3.11） |
| データベース | DynamoDB（ローカル開発は DynamoDB Local） |
| 開発方針 | **ローカル完結を最優先**。実 AWS へのデプロイはローカル検証完了後のみ |

### API 要件（方針）

| メソッド | 用途 |
|----------|------|
| `POST` | メモの新規作成（タイトル、本文、作成者/名前、タグ/カテゴリ等） |
| `GET` | メモの一覧取得 |
| `PUT` | メモの更新 |
| `DELETE` | メモの削除 |

---

## 2. ディレクトリ構成ルール（ルート配置型）

本プロジェクトは **ルート配置型** を採用する。`template.yaml` をリポジトリルートに置き、バックエンドとフロントエンドを分離する。

```text
team-memo-app-aws/
├── AGENTS.md                 # 本ファイル（エージェント／開発規約）
├── template.yaml             # AWS SAM テンプレート（正本）
├── samconfig.toml            # SAM CLI 設定（必要時。ローカル優先のため初期は最小）
├── README.md
│
├── docs/                     # 階層型ドキュメント（5ステップの成果物）
│   ├── spec.md               # 基本仕様書
│   ├── 要件定義書.md
│   ├── plan.md               # 全体計画・アプローチ方針
│   ├── 実装計画書.md
│   └── build.md              # ビルド・起動・デプロイ手順書
│
├── src/                      # Lambda（Python 3.11）ソース
│   └── memos/                # メモ CRUD ハンドラ一式
│       ├── app.py            # エントリポイント（lambda_handler）
│       ├── requirements.txt  # 関数依存関係（必要時）
│       └── ...               # バリデーション、DynamoDB アクセス等
│
├── frontend/                 # React + TypeScript (Vite) + Tailwind CSS
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── components/
│       ├── api/              # バックエンド API クライアント
│       └── types/
│
├── events/                   # sam local invoke 用のテストイベント JSON
└── tests/                    # バックエンド単体／統合テスト
```

ビルド・起動・（将来の）デプロイ手順の正本は `docs/build.md`。

### 配置ルール（厳守）

1. **`template.yaml` は必ずリポジトリルート**に置く。サブディレクトリへの移動は禁止。
2. **Lambda コードは `src/` 配下**に置く。`CodeUri` は `template.yaml` のパスと一致させる。
3. **フロントエンドは `frontend/` 配下**に完結させる。ルートの `package.json` でフロントを管理しない。
4. **仕様・計画ドキュメントは `docs/`** に置く（ルート直下への散在を避ける）。
5. 共有ユーティリティが必要になった場合は `src/common/` または Lambda Layer を検討し、フロントとバックでコードを混在させない。

---

## 3. コード規約

### 共通

- 言語・設定ファイルは **UTF-8**。改行はリポジトリの既存方針に合わせる（Windows でも LF 推奨）。
- 秘密情報（AWS キー、トークン等）をリポジトリにコミットしない。ローカル用は `.env` / `.env.local`（gitignore 対象）を使用。
- 変更は最小範囲に留め、依頼されていないリファクタやドキュメント追加を行わない。

### バックエンド（Python 3.11 / Lambda）

- ランタイムは **Python 3.11** 固定（`template.yaml` の `Globals` / 各 Function と一致）。
- ハンドラ名は `app.lambda_handler` を基本とする。
- API Gateway プロキシ統合を前提に、HTTP メソッド・パスで処理を分岐する。
- レスポンスは JSON。ステータスコードと `Content-Type: application/json` を明示する。
- DynamoDB アクセスは環境変数 `MEMOS_TABLE_NAME` を参照する（ハードコード禁止）。
- ローカルでは `DYNAMODB_ENDPOINT_URL`（例: `http://host.docker.internal:8000`）で DynamoDB Local を向ける。
- 例外は握りつぶさず、適切な 4xx/5xx とエラーメッセージを返す。

### フロントエンド（React / TypeScript / Vite / Tailwind）

- TypeScript の `strict` を維持する。
- API 呼び出しは `frontend/src/api/` に集約し、コンポーネントから直接 `fetch` URL を散在させない。
- 開発時の API ベース URL は環境変数（例: `VITE_API_BASE_URL`）で切替可能にする。デフォルトは SAM Local（`http://127.0.0.1:3000` 等）。
- UI スタイルは Tailwind CSS を使用する。新規の巨大な CSS フレームワークは追加しない。

### IaC（`template.yaml`）

- リソース名・論理 ID は意味が分かる英語 PascalCase（例: `MemosTable`, `MemosFunction`）。
- ARN やアカウント ID のハードコード禁止。`!Ref` / `!GetAtt` / `!Sub` を使用。
- CORS はフロント（localhost）からの呼び出しを想定して設定する。

---

## 4. ローカル優先開発ルール（厳格）

> **アプリがローカル環境（`http://localhost`）で完全に動作・テスト完了するまで、AWS 実環境へのデプロイは一切行わない。**

| ルール | 内容 |
|--------|------|
| デプロイ禁止期間 | ローカル E2E（フロント + SAM Local + DynamoDB Local）合格まで `sam deploy` / CloudFormation 実デプロイ禁止 |
| API 検証 | すべてのバックエンド API 検証は `sam local start-api` で実施 |
| DB 検証 | DynamoDB は **DynamoDB Local** を使用。実アカウントの DynamoDB を開発中に触らない |
| フロント検証 | Vite dev server（`http://localhost:5173` 等）から SAM Local API を呼び出す |
| 実環境 | ローカル完了後にのみ `docs/build.md` の手順に従いデプロイを検討する |

### 推奨ローカル構成（目安）

| コンポーネント | 典型的な起動 |
|----------------|--------------|
| DynamoDB Local | ポート `8000` |
| SAM Local API | `sam local start-api` → ポート `3000` |
| Vite (React) | `npm run dev` → ポート `5173` |

エージェントは、ユーザーが明示しない限り **実 AWS へのデプロイコマンドを提案・実行しない**。

---

## 5. ドキュメント体系（階層型 5 ステップフロー）

設計・実装は次の順序で進める。**前ステップの成果物を入力とし、飛ばさない。**

```text
1. template.yaml + AGENTS.md  →  docs/spec.md（基本仕様書）
2. docs/spec.md               →  docs/要件定義書.md
3. docs/要件定義書.md         →  docs/plan.md（全体計画・アプローチ方針）
4. docs/plan.md               →  docs/実装計画書.md（タスク分解・作業手順）
5. docs/実装計画書.md + 実装結果 →  docs/build.md（ビルド・起動・デプロイ手順書）
```

| ステップ | 入力 | 出力 | 目的 |
|----------|------|------|------|
| 1 | `template.yaml`, `AGENTS.md` | `docs/spec.md` | 構成・API・データモデルの基本仕様を固定 |
| 2 | `docs/spec.md` | `docs/要件定義書.md` | 機能・非機能・受け入れ条件を要件として定義 |
| 3 | `docs/要件定義書.md` | `docs/plan.md` | 全体方針・技術アプローチ・リスクを整理 |
| 4 | `docs/plan.md` | `docs/実装計画書.md` | 実装タスクを分解し、順序付き手順にする |
| 5 | `docs/実装計画書.md` + 実装結果 | `docs/build.md` | ローカル起動〜（将来の）デプロイ手順を記録 |

### ドキュメント更新ルール

- 仕様変更時は **該当ステップまで遡って更新**し、下流ドキュメントとの矛盾を残さない。
- `template.yaml` の API / リソース変更は、少なくとも `docs/spec.md` への反映を検討する。
- 実装だけ先行し、ドキュメントを空のままにしない（ステップ 4 完了前の本実装は原則行わない）。

---

## 6. エージェント作業時のチェックリスト

作業開始時:

- [ ] 本 `AGENTS.md` と現行 `template.yaml` を確認した
- [ ] 今どのドキュメントステップにいるか明確にした
- [ ] `docs/実装計画書.md` の §0.4 進捗と、指定範囲の Step ステータスを確認した
- [ ] ローカル検証手段（SAM Local / DynamoDB Local）を前提に設計・実装している

作業完了時:

- [ ] ディレクトリ規約（ルート `template.yaml` / `src/` / `frontend/`）を破っていない
- [ ] 実 AWS デプロイを実行・誘導していない（ローカル未完了の場合）
- [ ] 依頼範囲外のファイルを増やしていない
- [ ] **実装が正常完了した Step のステータスに `〇` を付けた**（`docs/実装計画書.md` §0.3）。配下必須 Step がすべて `〇` なら §0.4 の Phase 行も更新した
- [ ] ステータス更新なしで完了報告していない（コード実装と計画書の `〇` 更新は同一作業の一部）

---

## 7. 今回のステップ位置づけ

**現在: ステップ 4〜5（実装進行中 / `docs/build.md` 初版あり）**

- 実装タスクの正本: `docs/実装計画書.md`（進捗は同書の Step／Phase ステータス `〇` で管理。詳細は §0.3〜0.4）
- 起動・ビルド手順の正本: `docs/build.md`（AWS デプロイはローカル E2E 合格後に追記）
- 次アクション: 実装計画の未完了 Step を進め、Phase 2〜4 → E でローカル E2E を完了する。各範囲完了時は必ず `〇` を更新する
