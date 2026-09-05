# コレクション台帳 (Collection Log PWA)

レコード・本・マンガ・ファッション・その他の所有アイテムと購入履歴(日付・価格・購入場所)を記録するPWAです。
ブログ記事のネタ帳としての活用も想定しています。

`docs/collectionlogpwaspec.md` の仕様と、Claudeアーティファクトで作成した試作(単一HTMLファイル)を土台にしています。

## 特徴

- **PWA**: `manifest.webmanifest` + `sw.js`(Service Worker)により、ホーム画面への追加・standalone表示・オフライン閲覧に対応
- **ローカルDB**: IndexedDBでアイテムを永続化(localStorageのサイズ上限・同期APIの制約を避けるため採用。写真はBase64ではなくBlobのまま保存)
- **写真**: 撮影・選択した画像はクライアント側で長辺640px・JPEG品質0.7に自動リサイズしてから保存
- **オフラインファースト**: Webフォントに依存せず、OS標準の日本語フォント(Hiragino / Yu Gothic 等)を使用するため、初回オフラインでも表示崩れなし

## ディレクトリ構成

```
.
├── index.html            # アプリ本体(1画面)
├── manifest.webmanifest  # PWAマニフェスト
├── sw.js                 # Service Worker(キャッシュ・オフライン対応)
├── css/style.css         # スタイル
├── js/
│   ├── app.js            # 画面ロジック(タブ・追加フォーム・一覧・削除)
│   ├── db.js             # IndexedDBラッパー
│   └── image.js          # 写真リサイズ・圧縮
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

## ローカルでの動作確認

Service WorkerとIndexedDBはHTTPS(またはlocalhost)配信が必要なため、`file://`では正しく動作しません。任意の静的サーバーで配信してください。

```bash
# 例: Node.jsが入っていれば
npx serve .
# もしくは
python3 -m http.server 8080
```

ブラウザで `http://localhost:8080`(ポート番号は環境に合わせて読み替え)を開き、スマートフォンではブラウザメニューから「ホーム画面に追加」でインストールできます。

## データモデル

各アイテムは以下のフィールドを持ちます(`js/app.js` 参照)。

- `id` / `category` / `name` / `brand`
- `status`(`existing` = 既存所有 / `new` = 新規購入)
- `date` / `price` / `place`(新規購入時のみ)
- `notes` / `photo`(Blob、任意) / `createdAt`

## 今後の拡張候補(フェーズ2以降・未実装)

- アイテム単位でのMarkdown/テキストエクスポート(ブログ記事用)
- 検索・並び替え(価格順・購入日順など)
- レコード用途での外部アプリ連携(写真からのアーティスト・タイトル自動認識)
