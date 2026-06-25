import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { functions } from "../firebase";
import { useAuth } from "../hooks/useAuth";
import { fetchSentence } from "../hooks/useSentences";
import { saveAttempt } from "../hooks/useAttempts";
import { blobToWav, blobToBase64 } from "../lib/wav";
import {
  Sentence, AssessResult, SynthesizeResult, ratingColor, scoreColor,
} from "../types";

type RecState = "idle" | "recording" | "recorded";

export function Practice() {
  const { sentenceId } = useParams();
  const { user } = useAuth();

  const [sentence, setSentence] = useState<Sentence | null>(null);
  const [loading, setLoading] = useState(true);

  // お手本TTS
  const [ttsLoading, setTtsLoading] = useState(false);
  const ttsCache = useRef<Record<string, string>>({}); // rate -> objectURL

  // 録音
  const [recState, setRecState] = useState<RecState>("idle");
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const wavBlobRef = useRef<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // 評価
  const [assessing, setAssessing] = useState(false);
  const [result, setResult] = useState<AssessResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user || !sentenceId) return;
    fetchSentence(user.uid, sentenceId).then((s) => {
      setSentence(s);
      setLoading(false);
    });
  }, [user, sentenceId]);

  // ---- お手本の読み上げ ----
  const playSample = async (rate: number) => {
    if (!sentence) return;
    setError("");
    const cacheKey = String(rate);
    if (ttsCache.current[cacheKey]) {
      new Audio(ttsCache.current[cacheKey]).play();
      return;
    }
    setTtsLoading(true);
    try {
      const fn = httpsCallable<
        { text: string; lang: string; speakingRate: number },
        SynthesizeResult
      >(functions, "synthesizeSpeech");
      const res = await fn({ text: sentence.text, lang: sentence.lang, speakingRate: rate });
      const url = `data:${res.data.mimeType};base64,${res.data.audioBase64}`;
      ttsCache.current[cacheKey] = url;
      new Audio(url).play();
    } catch (e) {
      setError(`お手本の生成に失敗しました: ${(e as Error).message}`);
    } finally {
      setTtsLoading(false);
    }
  };

  // ---- 録音 ----
  const startRecording = async () => {
    setError("");
    setResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const raw = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        try {
          const wav = await blobToWav(raw);
          wavBlobRef.current = wav;
          if (recordedUrl) URL.revokeObjectURL(recordedUrl);
          setRecordedUrl(URL.createObjectURL(wav));
          setRecState("recorded");
        } catch (e) {
          setError(`録音の変換に失敗しました: ${(e as Error).message}`);
          setRecState("idle");
        }
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecState("recording");
    } catch (e) {
      setError(`マイクにアクセスできませんでした: ${(e as Error).message}`);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
  };

  // ---- 評価 ----
  const assess = async () => {
    if (!sentence || !wavBlobRef.current || !user) return;
    setAssessing(true);
    setError("");
    try {
      const audioBase64 = await blobToBase64(wavBlobRef.current);
      const fn = httpsCallable<
        { text: string; lang: string; audioBase64: string; mimeType: string },
        AssessResult
      >(functions, "assessPronunciation");
      const res = await fn({
        text: sentence.text,
        lang: sentence.lang,
        audioBase64,
        mimeType: "audio/wav",
      });
      setResult(res.data);
      await saveAttempt(user.uid, {
        sentenceId: sentence.id,
        sentenceTitle: sentence.title,
        overallScore: res.data.overallScore,
        transcript: res.data.transcript,
        wordIssues: res.data.wordIssues,
        advice: res.data.advice,
      });
    } catch (e) {
      setError(`発音評価に失敗しました: ${(e as Error).message}`);
    } finally {
      setAssessing(false);
    }
  };

  if (loading) return <div className="text-gray-400 text-center py-10">読み込み中...</div>;
  if (!sentence) {
    return (
      <div className="text-center py-10">
        <p className="text-gray-500 mb-4">英文が見つかりませんでした。</p>
        <Link to="/" className="text-violet-600 underline">英文一覧へ戻る</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/" className="text-sm text-violet-600">← 英文一覧</Link>
        <h1 className="text-xl font-bold text-gray-800 mt-2">{sentence.title}</h1>
      </div>

      {/* 英文表示 */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <p className="text-lg leading-relaxed text-gray-800">{sentence.text}</p>
      </div>

      {/* 1. お手本を聞く */}
      <section className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="font-semibold text-gray-700 mb-3">① お手本を聞く</h2>
        <div className="flex gap-2">
          <button
            onClick={() => playSample(1.0)}
            disabled={ttsLoading}
            className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg"
          >
            ▶ 通常速度
          </button>
          <button
            onClick={() => playSample(0.7)}
            disabled={ttsLoading}
            className="flex-1 border border-violet-300 text-violet-700 hover:bg-violet-50 disabled:opacity-50 font-medium py-2 rounded-lg"
          >
            🐢 ゆっくり
          </button>
        </div>
        {ttsLoading && <p className="text-xs text-gray-400 mt-2">音声を生成中...</p>}
      </section>

      {/* 2. シャドーイング録音 */}
      <section className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="font-semibold text-gray-700 mb-3">② シャドーイングして録音</h2>
        {recState !== "recording" ? (
          <button
            onClick={startRecording}
            className="w-full bg-red-500 hover:bg-red-600 text-white font-medium py-3 rounded-lg"
          >
            🎙 {recState === "recorded" ? "録り直す" : "録音開始"}
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="w-full bg-gray-800 hover:bg-gray-900 text-white font-medium py-3 rounded-lg animate-pulse"
          >
            ⏹ 録音停止
          </button>
        )}
        {recordedUrl && recState === "recorded" && (
          <div className="mt-3">
            <p className="text-xs text-gray-500 mb-1">自分の録音を確認:</p>
            <audio src={recordedUrl} controls className="w-full" />
          </div>
        )}
      </section>

      {/* 3. 発音を評価 */}
      <section className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="font-semibold text-gray-700 mb-3">③ AIに発音を評価してもらう</h2>
        <button
          onClick={assess}
          disabled={recState !== "recorded" || assessing}
          className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-medium py-3 rounded-lg"
        >
          {assessing ? "評価中..." : "🤖 発音を評価する"}
        </button>
        {recState !== "recorded" && (
          <p className="text-xs text-gray-400 mt-2">先に録音してください。</p>
        )}
      </section>

      {error && (
        <div className="bg-red-50 text-red-600 text-sm rounded-lg p-3">{error}</div>
      )}

      {/* 評価結果 */}
      {result && (
        <section className="bg-white rounded-xl shadow-sm p-5 space-y-4">
          <div className="text-center">
            <div className="text-sm text-gray-500">総合スコア</div>
            <div className={`text-5xl font-bold ${scoreColor(result.overallScore)}`}>
              {result.overallScore}
              <span className="text-2xl text-gray-400">/100</span>
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold text-gray-600 mb-1">AIが聞き取った発話</div>
            <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 italic">
              {result.transcript || "（聞き取れませんでした）"}
            </p>
          </div>

          {result.wordIssues.length > 0 && (
            <div>
              <div className="text-sm font-semibold text-gray-600 mb-2">単語ごとのポイント</div>
              <ul className="space-y-2">
                {result.wordIssues.map((w, i) => (
                  <li key={i} className="text-sm border-b border-gray-100 pb-2">
                    <span className={`font-semibold ${ratingColor(w.rating)}`}>
                      {w.word}
                    </span>
                    <span className="text-gray-400 text-xs ml-2">[{w.rating}]</span>
                    <p className="text-gray-600 mt-0.5">{w.comment}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <div className="text-sm font-semibold text-gray-600 mb-1">改善アドバイス</div>
            <div className="prose prose-sm max-w-none text-gray-700">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.advice}</ReactMarkdown>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
