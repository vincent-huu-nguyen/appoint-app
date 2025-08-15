// src/pages/Register.tsx
import { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useNavigate, Link } from "react-router-dom";

type Step = "email" | "details" | "verify";

const Register = () => {
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<"customer" | "admin" | "">("");

  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [sendingVerify, setSendingVerify] = useState(false);

  // --- validation helpers ---
  const isEmailValid = (v: string) => /^\S+@\S+\.\S+$/.test(v.trim());
  const isPasswordValid = (v: string) => v.length >= 6;
  const passwordsMatch = password === confirmPassword;
  const canProceed = isEmailValid(email) && isPasswordValid(password) && passwordsMatch;

  const handleGoToDetails = (chosenRole: "admin" | "customer") => {
    if (!canProceed) {
      setError(
        !isEmailValid(email)
          ? "Please enter a valid email address."
          : !isPasswordValid(password)
            ? "Password must be at least 6 characters."
            : !passwordsMatch
              ? "Passwords do not match."
              : "Please complete all fields."
      );
      return;
    }
    setError("");
    setRole(chosenRole);
    setStep("details");
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!role) {
        setError("Please choose a role.");
        return;
      }

      setSendingVerify(true);

      const userCred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const user = userCred.user;

      // Create user doc immediately (we already have role/name/phone here)
      const userData: any = {
        email: email.trim(),
        role,
        name: name.trim(),
        phone: phone.trim(),
        emailVerified: user.emailVerified || false,
      };

      if (role === "admin") {
        userData.businessName = businessName.trim();
        userData.businessNameLower = businessName.trim().toLowerCase();
        userData.approved = false; // optional moderation
      }

      await setDoc(doc(db, "users", user.uid), userData, { merge: true });

      // Send verification email
      await sendEmailVerification(user, {
        url: `${window.location.origin}/login`, // not used since we keep session; safe default
        handleCodeInApp: true,
      });

      // Don’t sign out. Stay signed in and wait for emailVerified to flip.
      setStep("verify");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSendingVerify(false);
    }
  };

  // Poll for verification while on the "verify" step
  useEffect(() => {
    if (step !== "verify") return;
    let timer: number | undefined;

    const checkVerified = async () => {
      const u = auth.currentUser;
      if (!u) return;
      await u.reload();
      if (u.emailVerified) {
        // route by role saved earlier
        navigate(role === "admin" ? "/dashboard" : "/appointments", { replace: true });
      } else {
        // keep polling
        timer = window.setTimeout(checkVerified, 3000);
      }
    };

    checkVerified();
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [step, role, navigate]);

  const formatPhoneNumber = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    const match = numbers.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);
    if (!match) return value;
    const [, area, prefix, line] = match;
    if (area && !prefix && !line) return area;
    if (area && prefix && !line) return `${area}-${prefix}`;
    if (area && prefix && line) return `${area}-${prefix}-${line}`;
    return value;
  };

  return (
    <div className="flex flex-col items-center justify-start min-h-screen pt-16 bg-gray-100 text-center px-4">
      <div className="text-[15rem] font-extrabold text-gray-800 select-none leading-none pointer-events-none">
        A<span className="text-indigo-600">.</span>
      </div>

      <div className="max-w-md mx-auto space-y-4 w-full mt-2">
        <h2 className="text-xl font-semibold text-center">Register</h2>

        {/* Step 1: Email & Password */}
        {step === "email" && (
          <div className="space-y-4">
            <div className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                placeholder="Email"
                autoComplete="email"
                className="border p-2 w-full rounded"
                required
              />
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                placeholder="Password (min 6 chars)"
                autoComplete="new-password"
                className="border p-2 w-full rounded"
                required
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError("");
                }}
                placeholder="Confirm Password"
                autoComplete="new-password"
                className="border p-2 w-full rounded"
                required
              />
              {error && (
                <p className="text-sm text-red-600" role="alert" aria-live="polite">
                  {error}
                </p>
              )}
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => handleGoToDetails("admin")}
                disabled={!canProceed || sendingVerify}
                className={`px-4 py-2 rounded w-1/2 text-white transition ${canProceed && !sendingVerify ? "bg-gray-800 hover:bg-gray-900" : "bg-gray-400 cursor-not-allowed"
                  }`}
                title={!canProceed ? "Enter email, password, and confirm password first" : ""}
              >
                Register as Business
              </button>

              <button
                type="button"
                onClick={() => handleGoToDetails("customer")}
                disabled={!canProceed || sendingVerify}
                className={`px-4 py-2 rounded w-1/2 text-white transition ${canProceed && !sendingVerify ? "bg-indigo-600 hover:bg-indigo-700" : "bg-indigo-300 cursor-not-allowed"
                  }`}
                title={!canProceed ? "Enter email, password, and confirm password first" : ""}
              >
                Register as Customer
              </button>
            </div>

            <p className="text-sm text-gray-600 mt-4">
              Already have an account?{" "}
              <Link to="/login" className="text-indigo-600 hover:underline">
                Login here
              </Link>
            </p>
          </div>
        )}

        {/* Step 2: Details */}
        {step === "details" && (
          <form onSubmit={handleFinalSubmit} className="space-y-4">
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
              placeholder="Your Name"
              className="border p-2 w-full rounded"
              required
            />

            {role === "admin" && (
              <input
                type="text"
                value={businessName}
                onChange={(e) => {
                  setBusinessName(e.target.value);
                  setError("");
                }}
                placeholder="Business Name"
                className="border p-2 w-full rounded"
                required
              />
            )}

            <input
              type="tel"
              value={phone}
              onChange={(e) => {
                setPhone(formatPhoneNumber(e.target.value));
                setError("");
              }}
              placeholder="Phone Number"
              className="border p-2 w-full rounded"
              required
            />

            {error && (
              <p className="text-sm text-red-600" role="alert" aria-live="polite">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={sendingVerify}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded w-full transition disabled:opacity-60"
            >
              {sendingVerify ? "Sending verification…" : "Create Account & Send Verification"}
            </button>
          </form>
        )}

        {/* Step 3: Verify (auto-routes when verified) */}
        {step === "verify" && (
          <div className="space-y-4">
            <p className="text-gray-700">
              We sent a verification link to <span className="font-semibold">{email}</span>.
              Click the link in your inbox to verify. We’ll automatically route you once it’s verified.
            </p>
            <p className="text-sm text-gray-500">
              Tip: if the email landed in Spam/Promotions, open it and mark <span className="font-medium">“Not spam”</span> (or move it to Inbox). This often makes the link clickable on mobile.
            </p>
            <p className="text-xs text-gray-500">
              On iPhone/Android, you can also long-press the link and choose “Open Link.”
            </p>

            <div className="text-xs text-gray-500">Waiting for verification…</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Register;
