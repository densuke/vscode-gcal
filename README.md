# Gcal Statusbar

VS Code のステータスバーに、今日の進行中または次の予定を表示する拡張です。

ステータスバーの表示をクリックすると、その日の予定一覧を確認できます。

## 前提

この拡張はローカルの `gcal` コマンドを使って予定を取得します。事前に以下でインストールしてください。

```bash
cargo install --git https://github.com/densuke/gcal.git
```

通常のインストール先である Cargo の bin ディレクトリを自動で探索します。

- macOS / Linux: `~/.cargo/bin`
- Windows: `%USERPROFILE%\\.cargo\\bin`

加えて、以下のパスも探索対象に含めています。

- `/opt/homebrew/bin`
- `/usr/local/bin`

## インストール

Marketplace 公開は行わず、GitHub Releases で配布する `.vsix` を使ってインストールします。

1. [Releases](https://github.com/densuke/vscode-gcal/releases) から最新の `.vsix` をダウンロードします。
2. VS Code で `Extensions: Install from VSIX...` を実行します。
3. ダウンロードした `.vsix` を選択します。

## 使い方

- ステータスバー右側に、進行中または次の予定が表示されます。
- 表示をクリックすると、今日の予定一覧を Quick Pick で確認できます。
- 予定は既定で 5 分ごとに自動更新されます。
- 手動更新したい場合は `Gcal Statusbar: Refresh` コマンドを実行します。

## 設定

### `gcalStatusbar.refreshIntervalSec`

予定を再取得する間隔です。既定値は `300` 秒です。

## gcal が見つからない場合

拡張起動時に `gcal` が見つからなければ警告を表示します。

インストール後、VS Code を再起動するか、ウィンドウを再読み込みしてください。

## リリース方法

このリポジトリでは GitHub Actions で `.vsix` を自動ビルドし、Release に添付します。

初回リリースは `v0.1.0` です。以後は次の手順でリリースします。

```bash
git tag v0.1.0
git push origin v0.1.0
```

タグ push 後、GitHub Actions が `.vsix` をビルドして Release を作成します。
