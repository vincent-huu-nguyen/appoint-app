import { useState } from "react";
import { auth, db } from "../firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

const Register = () => {
    const navigate = useNavigate();

    const [step, setStep] = useState<"email" | "details">("email");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState(""); // NEW
    const [role, setRole] = useState<"customer" | "admin" | "">("");

    const [name, setName] = useState("");
    const [businessName, setBusinessName] = useState("");
    const [phone, setPhone] = useState("");
    const [error, setError] = useState(""); // NEW

    // --- validation helpers ---
    const isEmailValid = (v: string) =>
        /^\S+@\S+\.\S+$/.test(v.trim());

    // Firebase requires min length 6; tweak if you want stronger rules
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

            const userCred = await createUserWithEmailAndPassword(auth, email.trim(), password);
            const user = userCred.user;

            const userData: any = {
                email: email.trim(),
                role,
                name: name.trim(),
                phone: phone.trim(),
            };

            if (role === "admin") {
                userData.businessName = businessName.trim();
                userData.businessNameLower = businessName.trim().toLowerCase();
            }

            await setDoc(doc(db, "users", user.uid), userData);

            // 🚀 Route to dashboard by role
            const target = role === "admin" ? "/dashboard" : "/appointments"; // or "/customer" if you have that
            navigate(target, { replace: true });
        } catch (err) {
            setError((err as Error).message);
        }
    };


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
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 text-center px-4">
            <div className="max-w-md mx-auto space-y-4 w-full">
                <h2 className="text-xl font-semibold text-center">Register</h2>

                {step === "email" ? (
                    <div className="space-y-4">
                        <div className="space-y-3">
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                                placeholder="Email"
                                autoComplete="email"
                                className="border p-2 w-full rounded"
                                required
                            />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                                placeholder="Password (min 6 chars)"
                                autoComplete="new-password"
                                className="border p-2 w-full rounded"
                                required
                            />
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
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
                                disabled={!canProceed}
                                className={`px-4 py-2 rounded w-1/2 text-white transition ${canProceed ? "bg-gray-800 hover:bg-gray-900" : "bg-gray-400 cursor-not-allowed"
                                    }`}
                                title={!canProceed ? "Enter email, password, and confirm password first" : ""}
                            >
                                Register as Business
                            </button>

                            <button
                                type="button"
                                onClick={() => handleGoToDetails("customer")}
                                disabled={!canProceed}
                                className={`px-4 py-2 rounded w-1/2 text-white transition ${canProceed ? "bg-indigo-600 hover:bg-indigo-700" : "bg-indigo-300 cursor-not-allowed"
                                    }`}
                                title={!canProceed ? "Enter email, password, and confirm password first" : ""}
                            >
                                Register as Customer
                            </button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleFinalSubmit} className="space-y-4">
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => { setName(e.target.value); setError(""); }}
                            placeholder="Your Name"
                            className="border p-2 w-full rounded"
                            required
                        />

                        {role === "admin" && (
                            <input
                                type="text"
                                value={businessName}
                                onChange={(e) => { setBusinessName(e.target.value); setError(""); }}
                                placeholder="Business Name"
                                className="border p-2 w-full rounded"
                                required
                            />
                        )}

                        <input
                            type="tel"
                            value={phone}
                            onChange={(e) => { setPhone(formatPhoneNumber(e.target.value)); setError(""); }}
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
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded w-full transition"
                        >
                            Complete Registration
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default Register;
