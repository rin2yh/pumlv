# pumlv

Go 製の PlantUML ローカルプレビューサーバ。`pumlv <path>` を叩くだけでブラウザに図が出て、ファイルを保存するたびに自動で再描画されます。Java も Docker も外部サーバも不要です。

- 完全ローカル描画 (`plantuml-core.jar.js` をブラウザで実行)
- ファイル変更検知 → SSE で自動再描画
- ファイル / ディレクトリ両対応、ディレクトリは再帰
- シングルバイナリ (`go:embed` でフロントエンド同梱)

## インストール

ビルド済みバイナリを使う場合:

```sh
go install github.com/yuukibarns/pumlv@latest
```

ソースからビルドする場合は下記の「開発」を参照してください。

## 使い方

```sh
pumlv ./docs                      # ディレクトリを再帰的に監視
pumlv ./design/seq.puml           # 単一ファイル
pumlv ./docs ./design/seq.puml    # 複数指定可
```

### フラグ

| フラグ | 既定値 | 説明 |
|--------|--------|------|
| `--port` | `0` (空きポートを自動選択) | TCP ポート |
| `--host` | `127.0.0.1` | バインド先ホスト |
| `--no-open` | `false` | ブラウザを自動起動しない |
| `--ext` | `.puml,.plantuml,.iuml,.wsd` | 監視対象の拡張子 |

起動すると `pumlv listening on http://127.0.0.1:<port>` と表示され、既定ブラウザが該当 URL を開きます。`Ctrl+C` で graceful shutdown します。

## HTTP API

ブラウザ向けに以下のエンドポイントを提供します。`/api/file` は起動時に列挙したパスのホワイトリストでディレクトリトラバーサルを防いでいます。

| Method | Path | 用途 |
|--------|------|------|
| GET | `/` | 埋め込み SPA を配信 (未知パスは `index.html` にフォールバック) |
| GET | `/api/files` | 監視対象ファイル一覧 (`[{path, rel, name, source}]`) |
| GET | `/api/file?path=...` | 指定ファイルのソース (text/plain) |
| GET | `/api/events` | SSE。イベント名は `hello` / `changed` / `tree` |

## アーキテクチャ

```
pumlv
├── main.go / cmd/root.go        # cobra エントリポイント
├── server/
│   ├── server.go                # net.Listen → http.Server、donegroup 配下で起動
│   ├── handlers.go              # /api/files /api/file /api/events と SPA 配信
│   ├── files.go                 # 対象ファイル列挙とホワイトリスト管理 (Registry)
│   ├── watcher.go               # fsnotify + 100ms デバウンス → Hub に broadcast
│   └── hub.go                   # SSE pub/sub
├── static/
│   ├── embed.go                 # //go:embed all:dist
│   └── dist/                    # frontend のビルド成果物 (pnpm build 出力)
└── frontend/                    # Vite + React19 + Tailwind v4
    ├── scripts/fetch-plantuml-core.mjs  # plantuml-core.jar.js を Releases から取得
    └── src/
        ├── App.tsx / components/
        ├── api/{files,events}.ts
        └── plantuml/renderer.ts # CheerpJ + plantuml-core.jar による SVG 生成
```

## 開発

### 前提

- Go 1.25 以上
- Node.js 22 以上 + pnpm 9

### セットアップ

```sh
go generate ./...   # frontend の pnpm install & build を実行し static/dist を生成
go build -o pumlv .
./pumlv ./examples
```

`go generate` は `go build` では自動実行されないため、フロントエンド資産を再生成したいときは明示的に実行してください。

開発時はフロントエンドの dev server を別途立てると HMR が効きます。

```sh
# ターミナル 1
./pumlv --no-open --port 8765 ./examples

# ターミナル 2
cd frontend && pnpm dev   # http://localhost:5173 (`/api` は :8765 にプロキシ)
```

### CI 用コマンド

```sh
# Go
go vet ./...
gofmt -l .          # 出力が空なら OK
go test ./...

# Frontend
cd frontend
pnpm lint           # oxlint
pnpm fmt:check      # oxfmt
pnpm test           # vitest
pnpm build          # ルートから `go generate ./...` でも代替可能
```

## PlantUML 描画について

ブラウザ内で完結させるため、PlantUML 公式の [plantuml-core](https://github.com/plantuml/plantuml-core) の CheerpJ ビルド (`plantuml-core.jar.js`, 約 17 MB) を同梱しています。`frontend/scripts/fetch-plantuml-core.mjs` が GitHub Releases API から取得し、Vite が `static/dist/` にコピーして `go:embed` で最終バイナリに格納されます。

> ⚠️ 注意: CheerpJ ランタイム本体 (`cjrtnc.leaningtech.com/2.3/loader.js`) は初回ロード時に CDN から取得されます。以後はブラウザキャッシュで動作し、PlantUML ソースが外部に送信されることはありません。

## ライセンス

MIT (`plantuml-core.jar.js` 同梱物のライセンスはアップストリームに従います)
