import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as crypto from "crypto";
import textToSpeech from "@google-cloud/text-to-speech";

// Functions のサービスアカウント認証(ADC)で Cloud Text-to-Speech を利用する。
// 事前に GCP コンソールで「Cloud Text-to-Speech API」を有効化しておくこと。
const ttsClient = new textToSpeech.TextToSpeechClient();

// 言語ごとのおすすめニューラル音声。指定が無い言語は languageCode のみで自動選択。
const VOICE_BY_LANG: Record<string, string> = {
  "en-US": "en-US-Neural2-C",
  "en-GB": "en-GB-Neural2-A",
  "en-AU": "en-AU-Neural2-A",
};

interface SynthesizeRequest {
  text: string;
  lang?: string; // 例: "en-US"
  speakingRate?: number; // 0.25〜4.0 (お手本のゆっくり再生に使用)
}

export const synthesizeSpeech = onCall(
  { region: "asia-northeast1", memory: "512MiB" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "ログインが必要です");

    const { text, lang = "en-US", speakingRate = 1.0 } = request.data as SynthesizeRequest;
    if (!text || !text.trim()) {
      throw new HttpsError("invalid-argument", "text is required");
    }

    const mimeType = "audio/mpeg";
    const rate = Math.max(0.25, Math.min(4.0, speakingRate));

    // 同じ(英文・言語・速度)の音声は Storage にキャッシュしてTTSコストを抑える
    const hash = crypto
      .createHash("sha1")
      .update(`${lang}|${rate}|${text}`)
      .digest("hex");
    const cachePath = `tts-cache/${hash}.mp3`;
    const bucket = admin.storage().bucket();
    const file = bucket.file(cachePath);

    try {
      const [exists] = await file.exists();
      if (exists) {
        const [buf] = await file.download();
        return { audioBase64: buf.toString("base64"), mimeType };
      }
    } catch {
      // キャッシュ参照に失敗しても合成にフォールバックする
    }

    const voiceName = VOICE_BY_LANG[lang];
    const [response] = await ttsClient.synthesizeSpeech({
      input: { text },
      voice: voiceName
        ? { languageCode: lang, name: voiceName }
        : { languageCode: lang, ssmlGender: "NEUTRAL" },
      audioConfig: { audioEncoding: "MP3", speakingRate: rate },
    });

    const audio = response.audioContent;
    if (!audio) throw new HttpsError("internal", "音声の生成に失敗しました");

    const audioBuffer = Buffer.from(audio as Uint8Array);

    // キャッシュ保存（失敗してもレスポンスは返す）
    try {
      await file.save(audioBuffer, { contentType: mimeType, resumable: false });
    } catch {
      // 保存失敗は無視
    }

    return { audioBase64: audioBuffer.toString("base64"), mimeType };
  }
);
