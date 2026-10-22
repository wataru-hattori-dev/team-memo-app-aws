# team-memo-app-aws

チーム共有メモアプリ（React + TypeScript + Vite、Python 3.11 Lambda、DynamoDB）。

ローカルではメモの作成・一覧・詳細／更新・削除まで動作確認済み。起動手順とデプロイ手順は `docs/build.md`（デプロイは §8）。実 AWS へのデプロイはまだ行っていない。

## 使用技術と役割

| 技術 | 役割 |
|------|------|
| フロント: React + TypeScript (Vite) + Tailwind CSS | メモの作成・一覧・更新・削除 UI。ビルド成果物（`frontend/dist`）を配信対象にする |
| API: Python 3.11 (Lambda) + API Gateway (REST API) | `POST` / `GET` `/memos`、`PUT` / `DELETE` `/memos/{memoId}` を提供する |
| DB: DynamoDB | メモレコード（`memoId`, `title`, `body`, `author`, `createdAt`, `updatedAt`）の永続化。ローカルは DynamoDB Local |
| インフラ（配信）: S3 + CloudFront | フロント静的ファイルのホスティングと HTTPS 配信（SPA、OAC、非公開バケット） |
| IaC: AWS SAM (`template.yaml`) | 上記リソースを `ap-northeast-1` に定義・デプロイする |

## 前提ツール

- AWS CLI v2（`aws configure` 済みの認証情報。プロファイルは `samconfig.toml` では指定しない）
- SAM CLI
- Node.js + npm（フロントビルド）
- Python 3.11（Lambda ランタイムと揃える）
- Docker（ローカルの DynamoDB Local）
