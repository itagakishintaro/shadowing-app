import * as functions from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

admin.initializeApp();

export { synthesizeSpeech } from "./synthesizeSpeech";
export { assessPronunciation } from "./assessPronunciation";

// ヘルスチェック用
export const ping = functions.onCall(() => ({ status: "ok" }));
