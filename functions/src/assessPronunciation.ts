import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { GoogleGenAI, Type } from "@google/genai";

// Gemini API キーは Secret Manager に保管（コードに書かない）。
// 登録: firebase functions:secrets:set GEMINI_API_KEY
const geminiApiKey = defineSecret("GEMINI_API_KEY");

interface AssessRequest {
  text: string; // お手本の英文（正解）
  lang?: string;
  audioBase64: string; // 16kHz モノラル WAV を base64 化したもの
  mimeType?: string; // 既定 "audio/wav"
}

const SYSTEM_INSTRUCTION = `あなたは経験豊富な英語の発音コーチです。
ユーザーが「お手本の英文」をシャドーイング（音読）した音声を聞き、発音を評価します。
- 文字起こし(transcript)はユーザーが実際に発話した内容を英語で書き起こす。
- overallScore は 0〜100 の整数。流暢さ・正確さ・イントネーションを総合評価する。
- wordIssues には、特に発音に課題がある単語を中心に挙げる(最大8件程度)。
  rating は good / fair / poor の3段階。comment は日本語で、どの音をどう直すか具体的に短く。
- advice は日本語のMarkdownで、次に意識すべき点を2〜4文でまとめる。励ましつつ実践的に。
必ず指定されたJSONスキーマに従って出力すること。`;

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    overallScore: { type: Type.INTEGER },
    transcript: { type: Type.STRING },
    wordIssues: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING },
          rating: { type: Type.STRING, enum: ["good", "fair", "poor"] },
          comment: { type: Type.STRING },
        },
        required: ["word", "rating", "comment"],
      },
    },
    advice: { type: Type.STRING },
  },
  required: ["overallScore", "transcript", "wordIssues", "advice"],
};

export const assessPronunciation = onCall(
  { secrets: [geminiApiKey], region: "asia-northeast1", memory: "512MiB", timeoutSeconds: 120 },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "ログインが必要です");

    const { text, lang = "en-US", audioBase64, mimeType = "audio/wav" } =
      request.data as AssessRequest;
    if (!text || !text.trim()) throw new HttpsError("invalid-argument", "text is required");
    if (!audioBase64) throw new HttpsError("invalid-argument", "audioBase64 is required");

    const ai = new GoogleGenAI({ apiKey: geminiApiKey.value() });

    const prompt = `お手本の英文（言語: ${lang}）:
"""
${text.trim()}
"""

添付した音声はユーザーがこの英文をシャドーイングしたものです。発音を評価してください。`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: audioBase64 } },
          ],
        },
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema,
        temperature: 0.3,
      },
    });

    const raw = response.text;
    if (!raw) throw new HttpsError("internal", "評価結果の生成に失敗しました");

    try {
      const parsed = JSON.parse(raw);
      return {
        overallScore: Number(parsed.overallScore) || 0,
        transcript: String(parsed.transcript ?? ""),
        wordIssues: Array.isArray(parsed.wordIssues) ? parsed.wordIssues : [],
        advice: String(parsed.advice ?? ""),
      };
    } catch {
      throw new HttpsError("internal", "評価結果の解析に失敗しました");
    }
  }
);
