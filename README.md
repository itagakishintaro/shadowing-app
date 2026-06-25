# Shadowing Coach

英語のシャドーイング（音読練習）をAIがサポートするWeb（PWA）アプリ。登録した英文を**お手本音声で読み上げ**、ユーザーの**録音を聞いてAIが発音を評価・改善指導**します。

## 主な機能

1. **英文登録** — 練習したい英文を登録・編集・削除
2. **読み上げ（正しい発音を理解）** — Google Cloud TTS のニューラル音声で再生（通常 / ゆっくり）
3. **シャドーイング（発音する）** — ブラウザのマイクで録音
4. **発音改善指導（改善する）** — Gemini が録音音声を聞き、総合スコア・単語別の課題・改善アドバイスを返す
5. 練習履歴・スコア推移の確認

---

## システムアーキテクチャ

```
Firebase Hosting
  └─ React + Vite (PWA / SPA)
        ├─ Firebase Auth (Google Sign-in)
        ├─ Firestore (英文・練習履歴)
        ├─ Firebase Storage (TTS音声キャッシュ)
        └─ Firebase Functions (asia-northeast1)
              ├─ synthesizeSpeech    ── テキスト → Google Cloud TTS → mp3
              └─ assessPronunciation ── 録音(WAV) + 正解英文 → Gemini → 評価JSON
```

### 技術スタック

| レイヤー | 技術 |
|---|---|
| フロントエンド | React 19 + Vite + TypeScript + Tailwind CSS (PWA) |
| バックエンド | Firebase Functions (Node.js 24) |
| 読み上げ(TTS) | Google Cloud Text-to-Speech (`@google-cloud/text-to-speech`) |
| 発音評価AI | Gemini `gemini-2.5-flash` (`@google/genai`) |
| DB | Firestore |
| 認証 | Firebase Auth (Google Sign-in) |
| ストレージ | Firebase Storage |
| ホスティング | Firebase Hosting |

### Firestoreデータモデル

```
users/{uid}/
  sentences/{id} : { title, text, lang, createdAt }
  attempts/{id}  : { sentenceId, sentenceTitle, overallScore,
                     transcript, wordIssues[], advice, createdAt }
```

### 音声フォーマットについて

ブラウザの `MediaRecorder` の出力（webm/opus など）は Gemini が対応していないことがあるため、
録音後に Web Audio API で **16kHz モノラル WAV** へ変換してから送信しています（`src/lib/wav.ts`）。

---

## セットアップ（初回）

### 1. Firebase プロジェクト作成

1. [Firebase コンソール](https://console.firebase.google.com/) で新規プロジェクトを作成
2. **Blazeプラン（従量課金）** にアップグレード（Functions / Cloud TTS / Gemini に必要）
3. Authentication で **Google** ログインを有効化
4. **Firestore** と **Storage** を有効化（本番モード）
5. Web アプリを追加し、設定スニペットを `src/firebase.ts` に貼り付け
6. `.firebaserc` の `REPLACE_WITH_YOUR_FIREBASE_PROJECT_ID` を実際のプロジェクトIDに置き換え

### 2. GCP API の有効化

Firebaseプロジェクトに紐づくGCPプロジェクトで以下を有効化:

- **Cloud Text-to-Speech API**
- **Generative Language API**（Gemini を Functions から使う場合は API キー方式のためこちらは任意。下記参照）

### 3. Gemini API キーの登録

[Google AI Studio](https://aistudio.google.com/apikey) で API キーを取得し、Secret Manager に登録:

```bash
firebase functions:secrets:set GEMINI_API_KEY
# プロンプトに API キーを入力
```

> Cloud TTS は Functions のサービスアカウント認証（ADC）で動くため、APIキー登録は不要です。

### 4. 依存関係のインストール

```bash
npm install
npm install --prefix functions
```

---

## ローカル開発

```bash
npm run dev   # http://localhost:5173
```

> Firestore / 認証 / Functions はデプロイ済みの本番Firebaseに接続します。
> マイク録音は `localhost` または HTTPS でのみ動作します。

---

## ビルド

```bash
npm run build                       # フロント (dist/)
cd functions && node_modules/.bin/tsc   # Functions の型チェック (lib/)
```

---

## デプロイ

```bash
npm run build
firebase deploy
```

個別デプロイ:

```bash
firebase deploy --only hosting
firebase deploy --only functions
firebase deploy --only firestore:rules
firebase deploy --only storage
```

---

## プロジェクト構成

```
shadowing/
├── src/                       # フロントエンド
│   ├── firebase.ts            # Firebase 初期化
│   ├── types.ts               # 型定義・ユーティリティ
│   ├── App.tsx                # ルーティング
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useSentences.ts
│   │   └── useAttempts.ts
│   ├── lib/
│   │   └── wav.ts             # 録音 → 16kHz WAV 変換
│   ├── components/Layout.tsx
│   └── pages/
│       ├── Login.tsx
│       ├── Sentences.tsx      # 英文登録
│       ├── Practice.tsx       # 読み上げ・録音・評価
│       └── History.tsx        # 履歴・スコア推移
├── functions/src/
│   ├── index.ts
│   ├── synthesizeSpeech.ts    # Cloud TTS
│   └── assessPronunciation.ts # Gemini 発音評価
├── firebase.json / firestore.rules / storage.rules
└── ...
```

---

## 補足: 発音評価の精度について

Gemini による評価は実用的ですが、音素レベルの厳密な採点（例: Azure Pronunciation Assessment）
ほど精密ではありません。より厳密な採点が必要になった場合は `assessPronunciation` を
Azure 発音評価などに差し替えられる設計にしています。
