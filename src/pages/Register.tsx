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
    const [role, setRole] = useState<"customer" | "admin" | "">("");

    const [name, setName] = useState("");
    const [businessName, setBusinessName] = useState("");
    const [phone, setPhone] = useState("");

    const handleEmailSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setStep("details");
    };

    const handleFinalSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const userCred = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCred.user;

            const userData: any = {
                email,
                role,
                name,
                phone,
            };

            if (role === "admin") {
                userData.businessName = businessName;
            }

            await setDoc(doc(db, "users", user.uid), userData);

            navigate(role === "admin" ? "/dashboard" : "/appointments");
        } catch (err) {
            alert((err as Error).message);
        }
    };

    const formatPhoneNumber = (value: string) => {
        const numbers = value.replace(/\D/g, ""); // remove non-digit characters
        const match = numbers.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);

        if (!match) return value;

        const [, area, prefix, line] = match;
        if (area && !prefix && !line) return area;
        if (area && prefix && !line) return `${area}-${prefix}`;
        if (area && prefix && line) return `${area}-${prefix}-${line}`;

        return value;
    };


    return (
        <div className="max-w-md mx-auto mt-10 space-y-4">
            <h2 className="text-xl font-semibold text-center">Register</h2>

            {step === "email" ? (
                <form onSubmit={handleEmailSubmit} className="space-y-4">
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Email"
                        className="border p-2 w-full"
                        required
                    />
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password"
                        className="border p-2 w-full"
                        required
                    />
                    <div className="flex gap-4">
                        <button
                            type="button"
                            onClick={() => {
                                setRole("admin");
                                setStep("details");
                            }}
                            className="bg-purple-600 text-white px-4 py-2 rounded w-full"
                        >
                            Register as Business
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setRole("customer");
                                setStep("details");
                            }}
                            className="bg-green-600 text-white px-4 py-2 rounded w-full"
                        >
                            Register as Customer
                        </button>
                    </div>
                </form>
            ) : (
                <form onSubmit={handleFinalSubmit} className="space-y-4">
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your Name"
                        className="border p-2 w-full"
                        required
                    />
                    {role === "admin" && (
                        <input
                            type="text"
                            value={businessName}
                            onChange={(e) => setBusinessName(e.target.value)}
                            placeholder="Business Name"
                            className="border p-2 w-full"
                            required
                        />
                    )}
                    <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
                        placeholder="Phone Number"
                        className="border p-2 w-full"
                        required
                    />
                    <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded w-full">
                        Complete Registration
                    </button>
                </form>
            )}
        </div>
    );
};

export default Register;
