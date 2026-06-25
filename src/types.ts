import { Timestamp } from "firebase/firestore";

// 登録した英文（シャドーイングの教材）
export interface Sentence {
  id: string;
  title: string;
  text: string;
  lang: string; // 例: "en-US"
  createdAt?: Timestamp;
}

// 発音評価で指摘された単語ごとの問題点
export interface WordIssue {
  word: string;
  // good | fair | poor の3段階で単語の発音品質を表す
  rating: "good" | "fair" | "poor";
  // 何がどう違うか・どう直すかの短い説明（日本語）
  comment: string;
}

// 1回のシャドーイング試行の結果
export interface Attempt {
  id: string;
  sentenceId: string;
  sentenceTitle: string;
  overallScore: number; // 0-100
  transcript: string; // AIが聞き取ったユーザーの発話
  wordIssues: WordIssue[];
  advice: string; // 全体的な改善アドバイス（Markdown）
  audioUrl?: string; // Storageに保存した録音音声のURL（任意）
  createdAt?: Timestamp;
}

// Function: assessPronunciation のレスポンス
export interface AssessResult {
  overallScore: number;
  transcript: string;
  wordIssues: WordIssue[];
  advice: string;
}

// Function: synthesizeSpeech のレスポンス
export interface SynthesizeResult {
  audioBase64: string;
  mimeType: string;
}

export const LANG_OPTIONS = [
  { value: "en-US", label: "英語（アメリカ）" },
  { value: "en-GB", label: "英語（イギリス）" },
  { value: "en-AU", label: "英語（オーストラリア）" },
] as const;

export function ratingColor(rating: WordIssue["rating"]): string {
  switch (rating) {
    case "good":
      return "text-green-600";
    case "fair":
      return "text-amber-500";
    case "poor":
      return "text-red-500";
  }
}

export function scoreColor(score: number): string {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-amber-500";
  return "text-red-500";
}
