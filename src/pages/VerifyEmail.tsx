// src/pages/VerifyEmail.tsx
import { useLocation } from "react-router-dom";
import { auth } from "../firebase";
import { sendEmailVerification } from "firebase/auth";
import { useState } from "react";

export default function VerifyEmail() {
  const location = useLocation() as any;
  const initialEmail = location?.state?.email || "";
  const [sending, setSending] = useState(false);
  const user = auth.currentUser; // likely null because we signed out

  const handleResend = async () => {
    if (!auth.currentUser) {
      alert("Please login first to resend verification.");
      return;
    }
    try {
      setSending(true);
      await sendEmailVerification(auth.currentUser, {
        url: `${window.location.origin}/login`,
        handleCodeInApp: true,
      });
      alert("Verification email sent!");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="bg-white rounded-2xl shadow p-6 max-w-md w-full text-center">
        <h1 className="text-xl font-semibold mb-2">Verify your email</h1>
        <p className="text-gray-700">
          We sent a verification link to <span className="font-medium">{initialEmail}</span>. Click the link in your inbox to activate your account.
        </p>
        <p className="text-sm text-gray-500 mt-3">
          Didn’t get it? Check spam, or click “Resend” after logging in.
        </p>

        <button
          onClick={handleResend}
          disabled={sending}
          className="mt-6 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded disabled:opacity-60"
        >
          {sending ? "Resending…" : "Resend verification email"}
        </button>
      </div>
    </div>
  );
}
