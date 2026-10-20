# ビルド・起動・デプロイ手順書

| 項目 | 内容 |
|------|------|
| ドキュメント | `docs/build.md` |
| 対象アプリ | team-memo-app-aws |
| 入力 | `docs/実装計画書.md`、実装結果、`template.yaml`、`env.json` |
| ステータス | 初版（ローカル手順）。AWS デプロイはローカル E2E 合格後に追記 |

---

## 1. 前提ツール

| ツール | 用途 | 備考 |
|--------|------|------|
| Docker | DynamoDB Local | Windows では Docker Desktop 推奨 |
| AWS SAM CLI | `sam build` / `sam local start-api` | Python 3.11 ランタイム対応 |
| AWS CLI | DynamoDB Local へのテーブル作成等 | ローカル用ダミー認証情報で可 |
| Node.js + npm | フロント（Vite） | `frontend/package.json` に合わせる |
| Python 3.11 | バックエンド／テスト | Lambda ランタイムと一致 |

秘密情報（実 AWS キー等）はリポジトリにコミットしない。ローカル DynamoDB 向けにはダミー値でよい。

---

## 2. ローカル構成（ポート）

| コンポーネント | ポート | 備考 |
|----------------|--------|------|
| DynamoDB Local | `8000` | ホスト側 |
| SAM Local API | `3000` | `sam local start-api` |
| Vite (React) | `5173` | `npm run dev` |

ローカル E2E 合格まで **`sam deploy` しない**（`AGENTS.md` / 要件 NFR-01）。

---

## 3. DynamoDB Local

### 3.1 起動（Docker 例）

リポジトリルートで、データ永続化する場合:

```powershell
docker run -d --name dynamodb-local -p 8000:8000 `
  -v "${PWD}/.dynamodb-local:/home/dynamodblocal/data" `
  amazon/dynamodb-local -jar DynamoDBLocal.jar -sharedDb -dbPath /home/dynamodblocal/data
```

既に同名コンテナがある場合は `docker start dynamodb-local` で再開できる。

### 3.2 テーブル作成

`env.json` の `MEMOS_TABLE_NAME`（現状 `team-memo`）と一致させる。PK は `memoId`（String / HASH）。

```powershell
$env:AWS_ACCESS_KEY_ID = "local"
$env:AWS_SECRET_ACCESS_KEY = "local"
$env:AWS_DEFAULT_REGION = "ap-northeast-1"

aws dynamodb create-table `
  --table-name team-memo `
  --attribute-definitions AttributeName=memoId,AttributeType=S `
  --key-schema AttributeName=memoId,KeyType=HASH `
  --billing-mode PAY_PER_REQUEST `
  --endpoint-url http://127.0.0.1:8000
```

確認:

```powershell
aws dynamodb list-tables --endpoint-url http://127.0.0.1:8000
```

---

## 4. バックエンド（SAM Local）

### 4.1 環境変数

ルートの `env.json`（SAM `--env-vars` 用）:

| 変数 | ローカル例 | 説明 |
|------|------------|------|
| `MEMOS_TABLE_NAME` | `team-memo` | 上記テーブル名と一致 |
| `DYNAMODB_ENDPOINT_URL` | `http://host.docker.internal:8000` | Lambda コンテナからホストの DynamoDB Local へ |
| `STAGE_NAME` | `local` | ステージ識別 |

Windows + Docker では `host.docker.internal` を使う（実装計画 R-04）。ホスト上の AWS CLI からは `http://127.0.0.1:8000`。

### 4.2 ビルドと API 起動

リポジトリルート:

```powershell
sam build
sam local start-api --env-vars env.json --port 3000
```

疎通の目安: `http://127.0.0.1:3000` に対して `POST /memos` や `GET /memos`（実装済みメソッド）が応答すること。単体確認は `events/` と `sam local invoke` も利用可。

---

## 5. フロントエンド（Vite）

```powershell
cd frontend
copy .env.example .env
npm install
npm run dev
```

`.env`（gitignore 対象）:

```text
VITE_API_BASE_URL=http://127.0.0.1:3000
```

ブラウザ: `http://localhost:5173`（または Vite が表示する URL）。

---

## 6. 推奨起動順

1. DynamoDB Local（`:8000`）→ テーブル作成済みであること
2. `sam build` → `sam local start-api --env-vars env.json`（`:3000`）
3. `frontend/` で `npm run dev`（`:5173`）
4. ブラウザで作成・一覧・更新・削除を確認

実装タスクの順序・完了条件は `docs/実装計画書.md` を正とする。

---

## 7. バックエンドテスト（任意）

```powershell
# 例: pytest（リポジトリの tests/ に合わせて実行）
pytest tests/
```

---

## 8. AWS へのデプロイ（未実施・後続）

ローカル E2E（フロント + SAM Local + DynamoDB Local）合格後に検討する。

追記予定の内容（案）:

- `sam deploy` / `samconfig.toml` のパラメータ（スタック名、リージョン、`StageName`）
- 実環境では `DYNAMODB_ENDPOINT_URL` を空のまま（テンプレート既定）にし、CloudFormation 管理のテーブルを使う
- フロントの `VITE_API_BASE_URL` を API Gateway の実 URL に切替
- CORS / 認証など本番向け設定の見直し

**現時点ではデプロイ手順の確定版は置かない。** 誤デプロイ防止のため、合格前に本節のコマンドを実行しない。

---

## 9. トラブルシュート（よくある点）

| 症状 | 確認すること |
|------|----------------|
| Lambda から DB に届かない | `env.json` の `DYNAMODB_ENDPOINT_URL` が `host.docker.internal:8000` か。DynamoDB Local コンテナが起動しているか |
| テーブルが無い | `MEMOS_TABLE_NAME` と create-table の名前が一致しているか。`--endpoint-url` を付け忘れていないか |
| ブラウザで CORS エラー | SAM Local と Vite の双方が起動しているか。API の OPTIONS / テンプレート CORS |
| フロントが API を叩けない | `VITE_API_BASE_URL` と SAM のポート（3000）が一致しているか。変更後は Vite の再起動 |

---

## 10. 更新ルール

- 起動コマンド・ポート・env 名が変わったら本ファイルを更新する
- 実装計画の Phase E（PE-7）で、E2E 実績と差分がないか見直す
- デプロイ章はローカル合格後に初めて具体化する
