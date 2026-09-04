# TEST-git-mac-os

共有フォルダ内で複数人が使える、社内向けの簡易掲示板です。

## 仕組み

サーバーは各自のPCで起動しますが、投稿・コメント・添付ファイルの実データは
**共有フォルダ内の1箇所**（`config.json` の `dataDir`、または環境変数 `DATA_DIR`
で指定したパス）に保存されます。共有フォルダが Mac / Windows 双方からマウント
できていれば、メンバーはそれぞれ自分のPCでこのアプリを起動し、ブラウザから
`http://localhost:3000` を開くだけで同じ掲示板を見ることができます。

サーバー用のPCを1台常時起動しておく必要はなく、ブラウザの制約（Safariなど
一部ブラウザはローカルファイルの直接読み書きに対応していない）も回避できます。

## セットアップ

1. 依存パッケージをインストール
   ```
   npm install
   ```
2. データの保存先を共有フォルダ内のパスに設定する（メンバー全員で同じパスを指す
   必要があります）。どちらか一方の方法で設定してください。
   - `config.json` を編集
     ```json
     { "dataDir": "/Volumes/SharedDrive/bulletin-data" }
     ```
     Windows の例: `"dataDir": "Z:\\bulletin-data"` や `"dataDir": "\\\\server\\share\\bulletin-data"`
   - もしくは環境変数で指定（`config.json` より優先されます）
     ```
     DATA_DIR="/Volumes/SharedDrive/bulletin-data" npm start
     ```
3. サーバーを起動
   ```
   npm start
   ```
4. ブラウザで `http://localhost:3000` を開く

`dataDir` を指定しない場合は、アプリ内の `./data` フォルダにローカル保存され
（動作確認用）、他のメンバーとは共有されません。

## 機能

- 投稿の追加・一覧表示（新しい順）
- 各投稿へのコメント返信
- 各投稿へのファイル添付（複数可、1ファイル最大20MB）

## ポート番号を変更する

```
PORT=8080 npm start
```
