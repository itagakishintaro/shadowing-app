import { useAuth } from "../hooks/useAuth";
import { useAttempts } from "../hooks/useAttempts";
import { scoreColor } from "../types";

function formatDate(ts?: { toDate: () => Date }): string {
  if (!ts) return "";
  const d = ts.toDate();
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
}

export function History() {
  const { user } = useAuth();
  const { attempts, loading } = useAttempts(user?.uid);

  const avg =
    attempts.length > 0
      ? Math.round(attempts.reduce((s, a) => s + a.overallScore, 0) / attempts.length)
      : 0;

  // スコア推移（古い順に並べて簡易バーで表示）
  const chrono = [...attempts].reverse();
  const recent = chrono.slice(-20);
  const maxBars = recent.length;

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-800 mb-4">練習履歴</h1>

      {loading ? (
        <div className="text-gray-400 text-center py-10">読み込み中...</div>
      ) : attempts.length === 0 ? (
        <div className="text-gray-400 text-center py-10">
          まだ練習記録がありません。英文を選んで練習してみましょう。
        </div>
      ) : (
        <>
          {/* サマリー */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="bg-white rounded-xl shadow-sm p-4 text-center">
              <div className="text-xs text-gray-500">練習回数</div>
              <div className="text-3xl font-bold text-gray-800">{attempts.length}</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4 text-center">
              <div className="text-xs text-gray-500">平均スコア</div>
              <div className={`text-3xl font-bold ${scoreColor(avg)}`}>{avg}</div>
            </div>
          </div>

          {/* スコア推移 */}
          {maxBars > 1 && (
            <div className="bg-white rounded-xl shadow-sm p-4 mb-5">
              <div className="text-sm font-semibold text-gray-600 mb-3">スコア推移（直近{maxBars}回）</div>
              <div className="flex items-end gap-1 h-28">
                {recent.map((a) => (
                  <div key={a.id} className="flex-1 flex flex-col justify-end" title={`${a.overallScore}`}>
                    <div
                      className={`w-full rounded-t ${
                        a.overallScore >= 80
                          ? "bg-green-400"
                          : a.overallScore >= 60
                          ? "bg-amber-400"
                          : "bg-red-400"
                      }`}
                      style={{ height: `${Math.max(4, a.overallScore)}%` }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 履歴リスト */}
          <ul className="space-y-3">
            {attempts.map((a) => (
              <li key={a.id} className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-800 truncate">{a.sentenceTitle}</div>
                    <div className="text-xs text-gray-400">{formatDate(a.createdAt)}</div>
                  </div>
                  <div className={`text-2xl font-bold ${scoreColor(a.overallScore)}`}>
                    {a.overallScore}
                  </div>
                </div>
                {a.transcript && (
                  <p className="text-sm text-gray-500 mt-2 italic line-clamp-2">「{a.transcript}」</p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
