# ビルド・起動・デプロイ手順書

| 項目 | 内容 |
|------|------|
| ドキュメント | `docs/build.md` |
| 対象アプリ | team-memo-app-aws |
| 入力 | `docs/実装計画書.md`、実装結果、`template.yaml`、`env.json` |
| ステータス | ローカル手順・E2E 確認コマンド・AWS デプロイ手順（§8）を記録済み。`sam deploy` は未実行 |
| シェル | **コマンドプロンプト（cmd.exe）前提**。以下のコードブロックはすべて cmd 用 |

> **シェルについて**  
> 本手順のコマンドは **コマンドプロンプト** 向けに記述している。  
> PowerShell では環境変数の設定（`set`）や行継続（`^`）の書き方が異なるため、そのまま貼ると動かない場合がある。  
> コマンドプロンプトで正常に動かない場合は、その旨を当該箇所に注記する（現状、本手順の範囲では cmd で完結できる）。

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

ローカル E2E は確認済み。実 AWS へ出すときの手順は §8。`sam deploy` はまだ実行していない。

---

## 3. DynamoDB Local

### 3.1 起動（Docker 例）

リポジトリルートで、データ永続化する場合（コマンドプロンプト）:

```cmd
docker run -d --name dynamodb-local -p 8000:8000 ^
  -v "%CD%\.dynamodb-local:/home/dynamodblocal/data" ^
  amazon/dynamodb-local -jar DynamoDBLocal.jar -sharedDb -dbPath /home/dynamodblocal/data
```

既に同名コンテナがある場合は `docker start dynamodb-local` で再開できる。手元で使っているコンテナ名は `dynamodb-local-team-memo`（`docker start dynamodb-local-team-memo`）。名前は `docker ps -a` で確認する。

> **注記（cmd 以外）**  
> PowerShell では行継続が `` ` ``、カレントディレクトリが `$PWD` になる。本手順は cmd の `^` / `%CD%` を正とする。

### 3.2 テーブル作成

`env.json` の `MEMOS_TABLE_NAME`（現状 `team-memo`）と一致させる。PK は `memoId`（String / HASH）。

コマンドプロンプトで環境変数を設定してから実行する（`set` は **そのウィンドウ内のみ** 有効）:

```cmd
set AWS_ACCESS_KEY_ID=local
set AWS_SECRET_ACCESS_KEY=local
set AWS_DEFAULT_REGION=ap-northeast-1

aws dynamodb create-table ^
  --table-name team-memo ^
  --attribute-definitions AttributeName=memoId,AttributeType=S ^
  --key-schema AttributeName=memoId,KeyType=HASH ^
  --billing-mode PAY_PER_REQUEST ^
  --endpoint-url http://127.0.0.1:8000
```

確認:

```cmd
aws dynamodb list-tables --endpoint-url http://127.0.0.1:8000
```

> **注記**  
> PowerShell の `$env:AWS_ACCESS_KEY_ID = "local"` はコマンドプロンプトでは使えない。必ず上記の `set` を使う。

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

リポジトリルート（コマンドプロンプト）:

```cmd
sam build
sam local start-api --env-vars env.json --port 3000
```

疎通の目安: `http://127.0.0.1:3000` に対して `POST /memos` や `GET /memos`（実装済みメソッド）が応答すること。単体確認は `events/` と `sam local invoke` も利用可。

---

## 5. フロントエンド（Vite）

コマンドプロンプト:

```cmd
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
4. 起動と確認の手順は次のとおり。合格条件の詳細は §6.1

実装タスクの順序・完了条件は `docs/実装計画書.md` を正とする。

### バックエンドでの動作確認

コマンドプロンプト。日本語が文字化けするときは、先に `chcp 65001` を実行する。保存される項目は `title`、`body`、`author` のみ（`tags` を付けても保存されない）。

**① DynamoDB Local 起動**

```cmd
docker start dynamodb-local-team-memo
```

`dynamodb-local-team-memo` はコンテナ名。§3.1 の例で作った場合は `docker start dynamodb-local`。

**② SAM Local API（バックエンド API サーバー）起動**

`src/memos` を変えたあとは、先に `sam build` する（§4.2）。

```cmd
cd C:\Users\ww-surface-90-u\Desktop\AI開発\team-memo-app-aws

set AWS_ACCESS_KEY_ID=local
set AWS_SECRET_ACCESS_KEY=local
set AWS_DEFAULT_REGION=us-east-1
sam local start-api --env-vars env.json --port 3000
```

このウィンドウは起動したままにする。`set` はそのウィンドウ内だけ有効。

**③ 新しいターミナルでメモを作成**

```cmd
curl -X POST http://127.0.0.1:3000/memos -H "Content-Type: application/json" -d "{\"title\":\"ツリーファイル提出\",\"body\":\"毎週金曜日に提出\",\"author\":\"山田 太郎\"}"
```

`201` と、応答の `memoId` を確認する。この `memoId` を、以降の「ここにmemoId」に入れる。

**④ 追加されているか確認**

```cmd
cd C:\Users\ww-surface-90-u\Desktop\AI開発\team-memo-app-aws

set AWS_ACCESS_KEY_ID=local
set AWS_SECRET_ACCESS_KEY=local
set AWS_DEFAULT_REGION=us-east-1
aws dynamodb scan --endpoint-url http://127.0.0.1:8000 --table-name team-memo --region us-east-1
```

**更新（API）**

```cmd
curl -i -X PUT http://127.0.0.1:3000/memos/ここにmemoId -H "Content-Type: application/json" -d "{\"title\":\"更新後タイトル\",\"body\":\"更新後本文\",\"author\":\"yamada\"}"
```

`200`。`createdAt` は作成時のまま、`updatedAt` だけ新しくなる。

**削除（API）**

```cmd
curl -i -X DELETE http://127.0.0.1:3000/memos/ここにmemoId
```

`204` でボディなし。画面や API からの削除はこちら。

**削除（テーブルから直接消す場合）**

API を通さない。②と同じ `set` をしたウィンドウで実行する。

```cmd
aws dynamodb delete-item --table-name team-memo --key "{\"memoId\":{\"S\":\"ここにmemoId\"}}" --endpoint-url http://127.0.0.1:8000 --region us-east-1
```

API を通す

```cmd
curl.exe -i -X DELETE "http://127.0.0.1:3000/memos/メモのID"
```

### フロントエンドでの動作確認

DynamoDB Local と SAM Local が動いていること。初回だけ `copy .env.example .env` と `npm install`（§5）。`.env` は `VITE_API_BASE_URL=http://127.0.0.1:3000`。

**① フロントのフォルダへ移動**

```cmd
cd C:\Users\ww-surface-90-u\Desktop\AI開発\team-memo-app-aws\frontend
```

**② 開発サーバー起動**

```cmd
npm run dev
```

ブラウザで `http://localhost:5173` を開く。作成 → 一覧 → 詳細 → 編集 → 削除の見方は §6.1。

### 6.1 ローカル E2E で確認した操作

前提は §6 の 1〜3（DynamoDB Local、SAM Local、Vite）が動いていること。コマンドはコマンドプロンプト。日本語が文字化けするときは、先に `chcp 65001` を実行する。

**画面（`http://localhost:5173`）**

作成（「新規作成」→ タイトル・本文・作成者 →「メモを保存」）→ 一覧に出る →「詳細」で本文が見える →「編集」→「変更を保存」で詳細と一覧が新しい内容になる → 詳細の「削除」→「削除する」で一覧から消える。

**API（4 メソッド）**

`{memoId}` は POST の応答に出た値に置き換える。

```cmd
curl -i -X POST http://127.0.0.1:3000/memos -H "Content-Type: application/json" -d "{\"title\":\"PE2 check\",\"body\":\"api body\",\"author\":\"tester\"}"
curl -i http://127.0.0.1:3000/memos
curl -i -X PUT http://127.0.0.1:3000/memos/{memoId} -H "Content-Type: application/json" -d "{\"title\":\"PE2 updated\",\"body\":\"updated body\",\"author\":\"tester\"}"
curl -i -X DELETE http://127.0.0.1:3000/memos/{memoId}
curl -i http://127.0.0.1:3000/memos
```

| 操作 | 合格 |
|------|------|
| POST `/memos` | `201`。`memoId` / `title` / `body` / `author` / `createdAt` / `updatedAt`。作成直後は `createdAt` と `updatedAt` が同じ |
| GET `/memos` | `200` の配列。0 件は `[]` |
| PUT `/memos/{memoId}` | `200`。`memoId` と `createdAt` は作成時のまま。`updatedAt` だけ新しい |
| DELETE `/memos/{memoId}` | `204` でボディなし |
| 削除後の GET | その `memoId` が配列にない |

**CORS とローカル DB**

```cmd
curl -i -X OPTIONS http://127.0.0.1:3000/memos -H "Origin: http://localhost:5173" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: Content-Type"
```

`200`、`Access-Control-Allow-Origin: *`、`Access-Control-Allow-Methods` に `GET,POST,PUT,DELETE,OPTIONS`。ブラウザのネットワークで `http://127.0.0.1:3000/memos` が `200`（作成なら `201`）になり、コンソールに CORS エラーが出ないこと。

SAM Local のログに次が出ること。

```text
dynamodb config table=team-memo endpoint=http://host.docker.internal:8000
```

`endpoint=(default AWS)` は不合格。ブラウザで作ったメモが、ローカルの 8000 番への scan に出ること（`set` はそのウィンドウ内だけ有効）。

```cmd
set AWS_ACCESS_KEY_ID=local
set AWS_SECRET_ACCESS_KEY=local
set AWS_DEFAULT_REGION=ap-northeast-1
aws dynamodb scan --table-name team-memo --endpoint-url http://127.0.0.1:8000
```

**異常系**

```cmd
curl -i -X POST http://127.0.0.1:3000/memos -H "Content-Type: application/json" -d "{\"body\":\"本文のみ\",\"author\":\"tester\"}"
curl -i -X POST http://127.0.0.1:3000/memos -H "Content-Type: application/json" -d "{bad"
curl -i -X PUT http://127.0.0.1:3000/memos/ffffffff-ffff-ffff-ffff-ffffffffffff -H "Content-Type: application/json" -d "{\"title\":\"t\",\"body\":\"b\",\"author\":\"a\"}"
curl -i -X DELETE http://127.0.0.1:3000/memos/ffffffff-ffff-ffff-ffff-ffffffffffff
```

| 操作 | 合格 |
|------|------|
| タイトルなし POST | `400` `{"message":"タイトルを入力してください。"}` |
| 壊れた JSON の POST | `400` `{"message":"リクエストの形式が正しくありません。"}` |
| 無い ID の PUT / DELETE | `404` `{"message":"メモが見つかりません。"}` |

DB 停止時の 500（確認後は必ず起動に戻す）。コンテナ名は起動に使ったもの（手元では `dynamodb-local-team-memo`。§3.1 の例なら `dynamodb-local`）。

```cmd
docker stop dynamodb-local-team-memo
curl -i http://127.0.0.1:3000/memos
docker start dynamodb-local-team-memo
```

停止中の GET は `500` と `{"message":"サーバーでエラーが発生しました。"}`。`docker start` のあと、同じ GET が `200` に戻ること。

**回帰用ファイル**

`events/` に `create-memo.json`、`create-memo-invalid.json`、`list-memos.json`、`update-memo.json`、`update-memo-not-found.json`、`delete-memo.json`、`delete-memo-not-found.json` があること。テストは §7。

---

## 7. バックエンドテスト（任意）

コマンドプロンプト:

```cmd
REM 例: pytest（リポジトリの tests/ に合わせて実行）
pytest tests/
```

---

## 8. AWS へのデプロイ

ローカル E2E（§6.1）のあと、この順で実行する。コマンドはコマンドプロンプト。秘密情報（アクセスキー等）はリポジトリに書かない。`aws configure` 済みの認証情報を使う。

この手順はまだ実行していない。

作られるもの（スタック名 `team-memo-app-dev`、リージョン `ap-northeast-1`、`StageName=dev`）:

| リソース | 内容 |
|----------|------|
| API Gateway / Lambda / DynamoDB | 既存のメモ API。テーブル名は `team-memo-app-memos-dev`（ローカルの `team-memo` とは別） |
| S3 | 画面ファイル用。パブリックアクセスはすべてブロック。公開ウェブサイト設定は使わない |
| CloudFront | HTTPS で S3 を配信（OAC）。入口は `https://xxxx.cloudfront.net`。既定オブジェクトは `index.html` |

API に認証はない。URL を知っていればメモの閲覧・作成・更新・削除ができる。画面バケットを非公開にしても、API 自体はインターネットから呼べる。

`DYNAMODB_ENDPOINT_URL` はテンプレート上は空のままにする。デプロイに `env.json` は渡さない（ローカルの DynamoDB Local 向け）。

`samconfig.toml` の `confirm_changeset = true` により、`sam deploy` は変更内容を表示してから `y` の入力を待つ。

### 8.1 認証の確認

```cmd
cd C:\Users\ww-surface-90-u\Desktop\AI開発\team-memo-app-aws
aws sts get-caller-identity
```

アカウントとユーザー（またはロール）が表示されれば次へ進む。

### 8.2 初回デプロイ（CORS は `*`）

`samconfig.toml` は `StageName=dev` だけを渡す。`CorsAllowOrigin` はテンプレート既定の `*` になる。ローカルの `sam local start-api` はこの deploy 設定を使わない。ローカルの CORS はテンプレート既定の `*` のまま。

```cmd
cd C:\Users\ww-surface-90-u\Desktop\AI開発\team-memo-app-aws
sam build
sam deploy
```

変更セットを確認し、問題なければ `y` を入力する。CloudFront の作成には数分かかることがある。

出力を控える。使う値は `MemosApiUrl`、`FrontendUrl`、`FrontendBucketName`、`FrontendDistributionId`。

```cmd
aws cloudformation describe-stacks --stack-name team-memo-app-dev --region ap-northeast-1 --query "Stacks[0].Outputs" --output table
```

`FrontendUrl` のホスト（例: `https://d111111abcdef8.cloudfront.net`）は、この時点ではまだ画面ファイルが無い。

### 8.3 画面のビルドと配置

`VITE_API_BASE_URL` には `MemosApiUrl` をそのまま入れる。末尾の `/memos` は付けない（画面側が `/memos` を足す）。`set` はそのウィンドウ内だけ有効で、Vite はビルド時にこの値を埋め込む。

```cmd
cd C:\Users\ww-surface-90-u\Desktop\AI開発\team-memo-app-aws\frontend
set VITE_API_BASE_URL=https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/dev
npm install
npm run build
aws s3 sync dist s3://ここにFrontendBucketName --delete --region ap-northeast-1
aws cloudfront create-invalidation --distribution-id ここにFrontendDistributionId --paths "/*"
```

`aws s3 sync --delete` は、バケット内にあって `dist` に無いオブジェクトを消す。このバケットには画面ファイル以外を置かない。

ディストリビューションが `Deployed` になってからブラウザで開く。

```cmd
aws cloudfront get-distribution --id ここにFrontendDistributionId --query "Distribution.Status" --output text
```

`Deployed` と出たら、ブラウザで `FrontendUrl` を開く。作成 → 一覧 → 詳細 → 編集 → 削除ができること。開発者ツールのネットワークで API が `MemosApiUrl` へ向かい、CORS エラーが出ないこと。

### 8.4 CORS を CloudFront の URL だけにする

§8.3 の確認が終わってから行う。`samconfig.toml` の `parameter_overrides` を、出力された `FrontendUrl` に合わせる（末尾スラッシュなし、引用符なし）。

```toml
parameter_overrides = "StageName=dev CorsAllowOrigin=https://d111111abcdef8.cloudfront.net"
```

```cmd
cd C:\Users\ww-surface-90-u\Desktop\AI開発\team-memo-app-aws
sam deploy
```

画面の再ビルドと S3 への再配置は不要。再度 `FrontendUrl` を開き、メモの一覧が取得できること。

CORS の確認（`Origin` は `FrontendUrl`）:

```cmd
curl -i -X OPTIONS https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/dev/memos -H "Origin: https://d111111abcdef8.cloudfront.net" -H "Access-Control-Request-Method: GET" -H "Access-Control-Request-Headers: Content-Type"
```

`Access-Control-Allow-Origin` が `https://d111111abcdef8.cloudfront.net` であること。

ローカル開発に戻すときは、これまでどおり DynamoDB Local、`sam local start-api --env-vars env.json`、`frontend/.env` の `VITE_API_BASE_URL=http://127.0.0.1:3000` を使う。`samconfig.toml` の `CorsAllowOrigin` はローカル起動には渡らない。

### 8.5 画面を更新するとき

API の URL が変わっていなければ、ビルドして配置し、キャッシュを無効化する。

```cmd
cd C:\Users\ww-surface-90-u\Desktop\AI開発\team-memo-app-aws\frontend
set VITE_API_BASE_URL=https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/dev
npm run build
aws s3 sync dist s3://ここにFrontendBucketName --delete --region ap-northeast-1
aws cloudfront create-invalidation --distribution-id ここにFrontendDistributionId --paths "/*"
```

API 側のコードを変えたときは、リポジトリルートで `sam build` してから `sam deploy` する。

### 8.6 スタックを消すとき

先にバケットを空にする。オブジェクトが残っているとバケットごと削除できない。DynamoDB のメモもスタック削除で消える。

```cmd
aws s3 rm s3://ここにFrontendBucketName --recursive --region ap-northeast-1
cd C:\Users\ww-surface-90-u\Desktop\AI開発\team-memo-app-aws
sam delete --stack-name team-memo-app-dev --region ap-northeast-1
```

CloudFront の削除には時間がかかることがある。

---

## 9. トラブルシュート（よくある点）

| 症状 | 確認すること |
|------|----------------|
| Lambda から DB に届かない | `env.json` の `DYNAMODB_ENDPOINT_URL` が `host.docker.internal:8000` か。DynamoDB Local コンテナが起動しているか |
| テーブルが無い | `MEMOS_TABLE_NAME` と create-table の名前が一致しているか。`--endpoint-url` を付け忘れていないか |
| ブラウザで CORS エラー | SAM Local と Vite の双方が起動しているか。API の OPTIONS / テンプレート CORS |
| フロントが API を叩けない | `VITE_API_BASE_URL` と SAM のポート（3000）が一致しているか。変更後は Vite の再起動 |
| `set` や `^` が効かない | PowerShell を開いていないか。タイトルバーやプロンプトが `PS ...>` ならコマンドプロンプト（`cmd`）を起動し直す |
| 行継続でエラーになる | `^` の直後にスペースを入れず、改行すること。PowerShell の `` ` `` を cmd に貼っていないか |

---

## 10. 更新ルール

- 起動コマンド・ポート・env 名が変わったら本ファイルを更新する
- **コマンド例はコマンドプロンプト（cmd）表記を正とする**。cmd で動かない場合のみ注記する
- ローカル E2E の確認コマンドは §6.1（起動コマンド §3〜§6 と合わせて記録済み）
- デプロイ手順は §8。スタック名、リージョン、CORS、画面の配置先を変えたら §8 も更新する
