import { useState, useEffect } from "react";
import {
  collection, query, orderBy, getDocs,
  addDoc, doc, updateDoc, deleteDoc, getDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { Sentence } from "../types";

export function useSentences(uid: string | undefined) {
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSentences = async () => {
    if (!uid) { setLoading(false); return; }
    const q = query(
      collection(db, "users", uid, "sentences"),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    setSentences(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Sentence)));
    setLoading(false);
  };

  useEffect(() => { fetchSentences(); }, [uid]);

  const addSentence = async (data: Omit<Sentence, "id" | "createdAt">) => {
    if (!uid) return;
    await addDoc(collection(db, "users", uid, "sentences"), {
      ...data,
      createdAt: serverTimestamp(),
    });
    await fetchSentences();
  };

  const updateSentence = async (id: string, data: Partial<Sentence>) => {
    if (!uid) return;
    await updateDoc(doc(db, "users", uid, "sentences", id), data);
    await fetchSentences();
  };

  const deleteSentence = async (id: string) => {
    if (!uid) return;
    await deleteDoc(doc(db, "users", uid, "sentences", id));
    await fetchSentences();
  };

  return { sentences, loading, addSentence, updateSentence, deleteSentence, refetch: fetchSentences };
}

// 単一の英文を取得（練習画面で使用）
export async function fetchSentence(uid: string, id: string): Promise<Sentence | null> {
  const snap = await getDoc(doc(db, "users", uid, "sentences", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Sentence;
}
