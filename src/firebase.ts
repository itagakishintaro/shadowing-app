import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

// TODO: 新規Firebaseプロジェクト作成後、コンソールの「プロジェクトの設定 > マイアプリ」の
// Web アプリ構成スニペットをここに貼り付けてください。
const firebaseConfig = {
  apiKey: "AIzaSyCFZQd7VZCPMIcyEz7A2X0ZNcdTueyTBzs",
  authDomain: "shadowing-7da76.firebaseapp.com",
  projectId: "shadowing-7da76",
  storageBucket: "shadowing-7da76.firebasestorage.app",
  messagingSenderId: "237348526485",
  appId: "1:237348526485:web:4e0909ef24d906f7e33e9c",
  measurementId: "G-HEH3ZSY195"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, "asia-northeast1");
export const googleProvider = new GoogleAuthProvider();
