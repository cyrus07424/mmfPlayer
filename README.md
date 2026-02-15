# MMF 着メロプレイヤー

携帯電話の着メロファイル（MMF/SMAF形式）をブラウザで再生できるWebアプリケーションです。

## 概要

MMF（Mobile Music File）/SMAF（Synthetic music Mobile Application Format）は、YAMAHAが開発した携帯電話向けの音楽フォーマットです。このプレイヤーを使用すると、懐かしい着メロファイルをモダンなブラウザで再生できます。

## 特徴

- 🎵 **MMF/SMAFファイル対応**: 携帯電話の着メロファイルを直接再生
- 🎨 **モダンなUI**: Tailwind CSSによる美しいグラデーションデザイン
- 📁 **ドラッグ&ドロップ対応**: ファイルを簡単にアップロード
- 🎮 **再生コントロール**: 再生/一時停止/停止を自在に操作
- 📊 **進捗表示**: リアルタイムで再生位置を表示
- 📝 **メタデータ表示**: 曲名、作曲者、編曲者などの情報を表示
- 📱 **レスポンシブデザイン**: スマートフォンからデスクトップまで対応

## 対応フォーマット

- MMF (Mobile Music File) - `.mmf`
- SMAF (Synthetic music Mobile Application Format) - `.smaf`

## サポート機能

- MMFDヘッダー検証
- チャンク構造解析（CNTI, MTR, Atsq等）
- MIDIイベントデータ抽出
- メタデータ解析（曲名、作曲者、編曲者、著作権情報）
- Web Audio APIによる音声合成
- オシレーターベースの音色生成
- ADSR エンベロープ

## 技術スタック

- **Next.js 16.1.6**: App Routerを使用したモダンなReactフレームワーク
- **TypeScript**: 型安全な開発
- **Web Audio API**: ブラウザネイティブの音声合成
- **Tailwind CSS 4**: モダンなスタイリング
- **React 19**: 最新のReactフレームワーク

## 使い方

### 開発環境のセットアップ

```bash
# 依存関係のインストール
npm install

# 開発サーバーの起動
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開きます。

### ファイルの再生方法

1. MMF/SMAFファイルをドラッグ&ドロップするか、「ファイルを選択」ボタンをクリック
2. ファイル情報が表示されたら、「▶ 再生」ボタンをクリック
3. 「⏸ 一時停止」で再生を一時停止、「⏹ 停止」で完全に停止
4. 進捗バーで現在の再生位置を確認できます

### ビルド

```bash
npm run build
npm start
```

## プロジェクト構成

```
mmfPlayer/
├── app/
│   ├── layout.tsx        # ルートレイアウト
│   ├── page.tsx          # メインページ
│   └── globals.css       # グローバルスタイル
├── components/
│   └── mmf-player-ui.tsx # MMFプレイヤーUIコンポーネント
├── lib/
│   ├── mmf-parser.ts     # MMF/SMAFパーサー
│   └── mmf-player.ts     # Web Audio API プレイヤー
└── public/               # 静的ファイル
```

## ライセンス

MIT License - 詳細は [LICENSE](LICENSE) ファイルを参照してください。

## 作者

[cyrus](https://github.com/cyrus07424)

## 参考情報

- [MMF/SMAF Format Specification](https://www.yamaha.com/ja/products/contents/apps/smaf/)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [Next.js Documentation](https://nextjs.org/docs)

