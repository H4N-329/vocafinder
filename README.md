# VocaFinder v5.1 — Vercel 対応 / ボカオバ風 UI

VocaFinder v5.0 の機能を維持し、**Vercel の無料 Hobby プランで公開しやすい静的サイト**にした更新版です。

## 今回の更新

- ボカオバリクエスト Web アプリに合わせた、**白ベース、シアンのグリッド背景、マゼンタとパープルのアクセント**に変更
- 楽曲・アーティスト検索、BPM、投稿日順、カバー/Remix、本人YouTubeチャンネル照合、iTunes/ニコニコ補完、手動編集、CSV、JSONバックアップは維持
- 画面密度を維持し、検索時は横長カードをPCで最大4列に表示。狭いスマートフォンでも検索条件が崩れないよう調整
- `vercel.json` を追加。**サーバー、ビルド、APIキーの常設設定は不要**
- `theme-bokaoba.css` は見た目だけを変更する追加スタイルで、処理コードは `js/` に分離したまま

## ファイル構成

```
index.html
styles.css
theme-bokaoba.css   ← 追加（見た目の変更）
vercel.json          ← 追加（Vercel設定）
.nojekyll            ← GitHub Pagesとの互換用。Vercelでは不要
.gitignore
js/
  api.js
  app.js
  artist.js
  channel-data.js
  manual.js
  official.js
  storage.js
  supplement.js
  utils.js
  youtube.js
README.md
```

> `theme-bokaoba.css` は `index.html` から読み込まれます。**必ず他のファイルと一緒にアップロード**してください。ZIPの親フォルダをGitHubのリポジトリ内に置くのではなく、上記ファイルをリポジトリ直下に置きます。

## 既存のGitHubリポジトリを使ってVercelで公開

1. このZIPをMacで解凍します。
2. GitHubでVocaFinder用リポジトリ（例：`vocafinder`）を開き、`Add file` → `Upload files` を選びます。
3. `index.html`、`styles.css`、`theme-bokaoba.css`、`vercel.json`、`.nojekyll`、`js`フォルダ全体、必要に応じて`README.md`を**リポジトリの一番上の階層**にアップロードします。既存の同名ファイルは置き換えます。
4. 変更を `Commit changes` で保存します。
5. [Vercel](https://vercel.com/new) にGitHubアカウントでログインし、「Add New…」→「Project」（画面の表記は変わることがあります）を開きます。
6. GitHubリポジトリ `vocafinder` を **Import** します。
7. 設定は **Framework Preset: Other / Root Directory: `./`（リポジトリ直下）/ Build Command: 空欄・ビルド不要 / Output Directory: `.`** とします。`vercel.json`にもフレームワークなし・ルート出力を指定済みです。
8. **Deploy** をクリックします。表示された `https://<プロジェクト名>.vercel.app` のURLで公開できます。

2回目以降はGitHubのmainブランチにプッシュすると、Vercelが自動デプロイします。

**ボカオバのアプリとは別のVercelプロジェクトとして公開**してください。別のリポジトリがあれば、このZIPを新しいリポジトリにアップロードしても構いません。

## GitHub PagesからVercelへ移るときのデータ移行（重要）

BPM修正、手動で追加した曲、公式チャンネルの設定などは**ブラウザ内のデータ**です。旧URL `github.io` と新URL `vercel.app` は保存領域が別のため、そのままでは引き継がれません。

1. **旧GitHub Pagesサイト**を開いて、「設定・バックアップ」→「設定をJSON出力」をクリックします。
2. ダウンロードしたJSONファイルを保存しておきます。
3. **新Vercelサイト**を開いて、「設定・バックアップ」→「JSONを取り込む」でそのファイルを選びます。
4. BPMや手動追加データ、公式チャンネル設定を確認してください。

※ サイト内で入力したYouTube APIキーはJSONバックアップに含みません。新URLでも自動照合を使う場合は、設定画面で再入力し、Google Cloudの**HTTPリファラー制限を新しい本番URLに合わせて更新**してください（例：`https://your-site.vercel.app/*`）。YouTube APIキーなしでも手動照合や検索リンクは使用できます。

## データ取得の仕組みと制限

- **VocaDB**：曲名、アーティスト、登録画像、BPM、動画URL、初公開日。公開APIへのアクセス。
- **ニコニコ**：候補の検索。ブラウザのCORS制限などで検索失敗する場合、外部検索リンクで対応。
- **iTunes**：配信日やジャケット等の候補。`releaseDate` は必ずしも初回配信日ではありません。
- **YouTube**：登録動画URL表示と外部検索。投稿者チャンネルIDの自動照合のみ任意のYouTube Data API v3キーが必要。

Vercelに移しても各サービスのCORSや利用制限は変わりません。曲名・画像・動画の情報が必ずすべて揃うわけではありません。GitHub Pagesと同様に、**Vercelに独自のバックエンドや共有データベースを置く構成ではありません**。

## ローカル表示（開発者向け）

HTMLファイルのダブルクリックではJavaScriptのESモジュールが読めない場合があります。Macのターミナルで、このフォルダを開いてから以下を実行し、`http://localhost:8000` をブラウザで開きます。

```bash
python3 -m http.server 8000
```

## 動作確認について

- HTML構造とJS構文、Vercel用JSONを確認
- ダミー検索結果によるPC・スマホの画面確認（1280px幅で4列・2行、390px幅で横スクロールなし）
- **Vercelへの実デプロイ、および実際のVocaDB/ニコニコ/iTunes/YouTube APIへのアクセスは未検証**

無料Hobbyプランには利用条件・上限があります。非商用の個人プロジェクト用途を想定しています。
