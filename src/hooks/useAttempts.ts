import { useState, useEffect } from "react";
import {
  collection, query, orderBy, getDocs, addDoc, limit, serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { Attempt } from "../types";

export function useAttempts(uid: string | undefined, limitCount = 100) {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAttempts = async () => {
    if (!uid) { setLoading(false); return; }
    const q = query(
      collection(db, "users", uid, "attempts"),
      orderBy("createdAt", "desc"),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    setAttempts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Attempt)));
    setLoading(false);
  };

  useEffect(() => { fetchAttempts(); }, [uid, limitCount]);

  return { attempts, loading, refetch: fetchAttempts };
}

export async function saveAttempt(uid: string, data: Omit<Attempt, "id" | "createdAt">) {
  await addDoc(collection(db, "users", uid, "attempts"), {
    ...data,
    createdAt: serverTimestamp(),
  });
}
