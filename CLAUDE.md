# Shadowing Coach

英語シャドーイング（音読練習）支援アプリ。登録した英文を Google Cloud TTS で読み上げ、ユーザーの録音を Gemini が聞いて発音を評価・改善指導する。

## 主要コマンド

```bash
# 開発サーバー起動
npm run dev

# フロントエンドビルド
npm run build

# Functions の型チェック
cd functions && node_modules/.bin/tsc

# デプロイ（ビルド後に実行）
firebase deploy

# Functionsのみデプロイ
firebase deploy --only functions

# Gemini APIキーの登録（初回のみ）
firebase functions:secrets:set GEMINI_API_KEY
```

## 技術スタック

- フロントエンド: React 19 + Vite + TypeScript + Tailwind CSS (PWA)
- バックエンド: Firebase Functions (Node.js 24)
- 読み上げ: Google Cloud Text-to-Speech (`@google-cloud/text-to-speech`)
- 発音評価: Gemini `gemini-2.5-flash` (`@google/genai`)
- DB: Firestore / 認証: Firebase Auth (Google) / ストレージ: Firebase Storage / ホスティング: Firebase Hosting

## 重要な注意点

- **APIキーはコードに書かない**: `GEMINI_API_KEY` は Firebase Secret Manager に保管
- **AI呼び出しはFunctions経由のみ**: フロントから直接呼ばない
- **Cloud TTS はサービスアカウント認証(ADC)**: GCP で「Cloud Text-to-Speech API」を有効化しておくこと
- **録音は WAV 変換が必須**: `MediaRecorder` 出力を `src/lib/wav.ts` で 16kHz モノラル WAV に変換してから Gemini に渡す（Gemini が webm/opus 非対応なため）
- **TTS音声は Storage にキャッシュ**: 同一(英文・言語・速度)はキャッシュから返してコスト削減
- Functions の predeploy は `cd functions && node_modules/.bin/tsc`
- `src/firebase.ts` と `.firebaserc` はプレースホルダー。新規Firebaseプロジェクトの値に置き換えること

## ファイル構成

```
src/                    # フロントエンド
  firebase.ts           # Firebase初期化（要設定）
  types.ts              # 型定義
  lib/wav.ts            # 録音 → 16kHz WAV 変換
  hooks/                # useAuth / useSentences / useAttempts
  pages/                # Login / Sentences / Practice / History
functions/src/          # Firebase Functions
  synthesizeSpeech.ts   # テキスト → Cloud TTS → mp3（Storageキャッシュ）
  assessPronunciation.ts# 録音(WAV) + 正解英文 → Gemini → 評価JSON
```

## Firestoreデータモデル

```
users/{uid}/
  sentences/{id} : { title, text, lang, createdAt }
  attempts/{id}  : { sentenceId, sentenceTitle, overallScore, transcript, wordIssues[], advice, createdAt }
```
