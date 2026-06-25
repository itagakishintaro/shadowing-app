// 録音音声(webm/opus 等)を Gemini が確実に扱える 16kHz モノラル WAV に変換するユーティリティ。
//
// MediaRecorder の既定出力は環境によって webm/opus や mp4/aac とまちまちで、
// Gemini が対応していないフォーマットになることがある。そこで Web Audio API で
// 一度デコードしてから、リサンプル + WAV(PCM 16bit) として再エンコードすることで
// 端末・ブラウザに依存せず安定した入力を作る。

const TARGET_SAMPLE_RATE = 16000;

// Blob(任意の音声) → 16kHz モノラル WAV の Blob
export async function blobToWav(blob: Blob): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  // decodeAudioData は元の音声フォーマットを自動判別してPCMにデコードする
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new AudioCtx();
  const decoded = await audioCtx.decodeAudioData(arrayBuffer);
  audioCtx.close();

  const mono = downmixToMono(decoded);
  const resampled = await resample(mono, decoded.sampleRate, TARGET_SAMPLE_RATE);
  return encodeWav(resampled, TARGET_SAMPLE_RATE);
}

// WAV Blob → base64 文字列（Function へ渡す用）
export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function downmixToMono(buffer: AudioBuffer): Float32Array {
  const channels = buffer.numberOfChannels;
  if (channels === 1) return buffer.getChannelData(0).slice();
  const length = buffer.length;
  const out = new Float32Array(length);
  for (let ch = 0; ch < channels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) out[i] += data[i] / channels;
  }
  return out;
}

async function resample(
  data: Float32Array,
  fromRate: number,
  toRate: number
): Promise<Float32Array> {
  if (fromRate === toRate) return data;
  const offlineLength = Math.ceil((data.length * toRate) / fromRate);
  const offline = new OfflineAudioContext(1, offlineLength, toRate);
  const srcBuffer = offline.createBuffer(1, data.length, fromRate);
  srcBuffer.getChannelData(0).set(data);
  const source = offline.createBufferSource();
  source.buffer = srcBuffer;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0).slice();
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  // RIFF ヘッダ
  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, "WAVE");
  // fmt チャンク
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // チャンクサイズ
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // モノラル
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // バイトレート
  view.setUint16(32, 2, true); // ブロックアライン
  view.setUint16(34, 16, true); // ビット深度
  // data チャンク
  writeString(36, "data");
  view.setUint32(40, samples.length * 2, true);

  // Float32 [-1,1] → Int16 PCM
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
}
