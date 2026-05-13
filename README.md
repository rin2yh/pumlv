# pumlv

Go 製の PlantUML ローカルプレビューサーバ。`pumlv <path>` を叩くだけでブラウザに図が出て、ファイルを保存するたびに自動で再描画されます。Java も Docker も外部サーバも不要です。

- 完全ローカル描画 (`plantuml-core.jar.js` をブラウザで実行)
- ファイル変更検知 → SSE で自動再描画
- ファイル / ディレクトリ両対応、ディレクトリは再帰
- シングルバイナリ (`go:embed` でフロントエンド同梱)

## 背景

既存の PlantUML プレビュー手段には以下の課題がありました。

- 大半が特定エディタ (VSCode / IntelliJ / Vim プラグイン等) に依存しており、エディタを変えると使えない
- ローカル描画には Java や Graphviz、もしくは Docker など別のツールを別途インストールする必要がある

pumlv はエディタに依存せず、シングルバイナリ 1 つでブラウザに描画する (`plantuml-core` を CheerpJ 経由でブラウザ内実行) ことでこれらを解消することを目的としています。

> 本リポジトリは [k1LoW/mo](https://github.com/k1LoW/mo) (Markdown のローカルプレビューサーバ) からインスパイアを受けて作成されています。

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

### レンダリングテスト (E2E)

Playwright 駆動の実描画テストを `frontend/tests/e2e/` に用意しています。実 Chrome を立ち上げて `pumlv` バイナリをサーバとして spawn し、ブラウザ内 CheerpJ + plantuml-core が `examples/` を本当に描画できることを確認します。CheerpJ ランタイムは初回ロード時に `cjrtnc.leaningtech.com` から取得されるため、E2E 実行時はネットワークが必要です。

```sh
make build          # ルートに pumlv バイナリを生成
make e2e            # frontend で pnpm test:e2e (Playwright)
make screenshot     # README 用画像を ./images/ に保存
```

Playwright 本体と Chrome は別途インストールが必要です:

```sh
cd frontend
pnpm install
pnpm exec playwright install --with-deps chrome
```

## PlantUML 描画について

ブラウザ内で完結させるため、PlantUML 公式の [plantuml-core](https://github.com/plantuml/plantuml-core) の CheerpJ ビルド (`plantuml-core.jar.js`, 約 17 MB) を同梱しています。`frontend/scripts/fetch-plantuml-core.mjs` が GitHub Releases API から取得し、Vite が `static/dist/` にコピーして `go:embed` で最終バイナリに格納されます。

> ⚠️ 注意: CheerpJ ランタイム本体 (`cjrtnc.leaningtech.com/2.3/loader.js`) は初回ロード時に CDN から取得されます。以後はブラウザキャッシュで動作し、PlantUML ソースが外部に送信されることはありません。

## ライセンス

本リポジトリのソースコードは [MIT License](./LICENSE) です。

### 同梱・実行時取得される第三者コンポーネント

#### バイナリ / フロントエンド成果物に同梱

| コンポーネント | ライセンス | 備考 |
|---|---|---|
| [plantuml/plantuml-core](https://github.com/plantuml/plantuml-core) (`plantuml-core.jar`, `plantuml-core.jar.js`) | MIT | `frontend/scripts/fetch-plantuml-core.mjs` で取得し `static/dist/` に同梱 |
| [React](https://github.com/facebook/react) (`react`, `react-dom`) | MIT | バンドル |
| [Shiki](https://github.com/shikijs/shiki) | MIT | バンドル |
| [Tailwind CSS](https://tailwindcss.com/) | MIT | バンドル |

開発専用 (DevDependencies、最終バイナリには含まれない):

| コンポーネント | ライセンス | 備考 |
|---|---|---|
| [Playwright](https://playwright.dev/) (`@playwright/test`) | Apache-2.0 | E2E レンダリングテスト用 (`frontend/tests/e2e/`, `frontend/scripts/screenshots.mjs`) |

#### 実行時に CDN から取得 (ブラウザ側)

| コンポーネント | ライセンス | 備考 |
|---|---|---|
| [CheerpJ Runtime 2.3](https://cheerpj.com/) (`cjrtnc.leaningtech.com/2.3/loader.js`) | CheerpJ Community License | OSS / 非商用利用は無償 (`cjrtnc.leaningtech.com` ドメインからの利用に限る)。商用の社内利用等は別途 Commercial License が必要 |

#### Go バイナリにリンクされる主な依存

| モジュール | ライセンス |
|---|---|
| `github.com/spf13/cobra` | Apache-2.0 |
| `github.com/spf13/pflag` | BSD-3-Clause |
| `github.com/fsnotify/fsnotify` | BSD-3-Clause |
| `github.com/k1LoW/donegroup` | MIT |
| `github.com/muesli/termenv` | MIT |
| `github.com/pkg/browser` | BSD-2-Clause |
| `github.com/aymanbagabas/go-osc52/v2` | MIT |
| `github.com/mattn/go-isatty` | MIT |
| `github.com/rivo/uniseg` | MIT |
| `github.com/lucasb-eyer/go-colorful` | MIT |
| `github.com/inconshreveable/mousetrap` | Apache-2.0 |
| `golang.org/x/sys` | BSD-3-Clause |

各ライセンスの全文は各リポジトリの `LICENSE` を参照してください。

