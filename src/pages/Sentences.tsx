import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useSentences } from "../hooks/useSentences";
import { Sentence, LANG_OPTIONS } from "../types";

export function Sentences() {
  const { user } = useAuth();
  const { sentences, loading, addSentence, updateSentence, deleteSentence } = useSentences(user?.uid);
  const navigate = useNavigate();

  const [editing, setEditing] = useState<Sentence | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [lang, setLang] = useState<string>("en-US");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const openNew = () => {
    setEditing(null);
    setTitle("");
    setText("");
    setLang("en-US");
    setShowForm(true);
  };

  const openEdit = (s: Sentence) => {
    setEditing(s);
    setTitle(s.title);
    setText(s.text);
    setLang(s.lang);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!text.trim()) return;
    setSaving(true);
    setError("");
    const data = { title: title.trim() || text.trim().slice(0, 30), text: text.trim(), lang };
    try {
      if (editing) {
        await updateSentence(editing.id, data);
      } else {
        await addSentence(data);
      }
      setShowForm(false);
    } catch (e) {
      setError(`保存に失敗しました: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (s: Sentence) => {
    if (!confirm(`「${s.title}」を削除しますか？`)) return;
    try {
      await deleteSentence(s.id);
    } catch (e) {
      setError(`削除に失敗しました: ${(e as Error).message}`);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">登録した英文</h1>
        <button
          onClick={openNew}
          className="bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          ＋ 英文を追加
        </button>
      </div>

      {loading ? (
        <div className="text-gray-400 text-center py-10">読み込み中...</div>
      ) : sentences.length === 0 ? (
        <div className="text-gray-400 text-center py-10">
          まだ英文がありません。「英文を追加」から登録しましょう。
        </div>
      ) : (
        <ul className="space-y-3">
          {sentences.map((s) => (
            <li key={s.id} className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold text-gray-800 truncate">{s.title}</div>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{s.text}</p>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => navigate(`/practice/${s.id}`)}
                  className="flex-1 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium py-2 rounded-lg"
                >
                  🎙 練習する
                </button>
                <button
                  onClick={() => openEdit(s)}
                  className="px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  編集
                </button>
                <button
                  onClick={() => handleDelete(s)}
                  className="px-3 py-2 text-sm text-red-500 border border-gray-300 rounded-lg hover:bg-red-50"
                >
                  削除
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl p-5 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-800 mb-4">
              {editing ? "英文を編集" : "英文を追加"}
            </h2>
            <label className="block text-sm font-medium text-gray-600 mb-1">タイトル（任意）</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: 自己紹介フレーズ"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4"
            />
            <label className="block text-sm font-medium text-gray-600 mb-1">英文</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              placeholder="Practicing English every day helps you improve."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4"
            />
            <label className="block text-sm font-medium text-gray-600 mb-1">言語・アクセント</label>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-5"
            >
              {LANG_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {error && (
              <div className="bg-red-50 text-red-600 text-sm rounded-lg p-3 mb-3">{error}</div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !text.trim()}
                className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg"
              >
                {saving ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
