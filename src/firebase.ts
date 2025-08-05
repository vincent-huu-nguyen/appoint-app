// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDtdk-9NcPXk33tICqO4VHIGmIHzSjlgec",
  authDomain: "appoint-app-e72f8.firebaseapp.com",
  projectId: "appoint-app-e72f8",
  storageBucket: "appoint-app-e72f8.firebasestorage.app",
  messagingSenderId: "362579565756",
  appId: "1:362579565756:web:55a971314f62cb5d7404b9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
