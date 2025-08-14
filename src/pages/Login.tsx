import { useState } from "react";
import { auth, db } from "../firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useNavigate, Link } from "react-router-dom";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const userCred = await signInWithEmailAndPassword(auth, email, password);
      const user = userCred.user;
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const role = userSnap.data().role;
        role === "admin" ? navigate("/dashboard") : navigate("/appointments");
      }
    } catch (err) {
      alert((err as Error).message);
    }
  };

  return (
    <div className="flex flex-col items-center justify-start min-h-screen pt-16 bg-gray-100 text-center px-4">
      {/* Giant logo */}
      <div className="text-[15rem] font-extrabold text-gray-800 select-none leading-none pointer-events-none">
        A<span className="text-indigo-600">.</span>
      </div>

      <form onSubmit={handleLogin} className="max-w-md mx-auto space-y-4 w-full mt-2">
        <h2 className="text-xl font-semibold">Login</h2>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="border p-2 w-full rounded"
          required
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="border p-2 w-full rounded"
          required
        />
        <button
          type="submit"
          className="bg-indigo-600 text-white px-6 py-2 rounded hover:bg-indigo-700 transition w-full"
        >
          Login
        </button>

        {/* Footer link */}
        <p className="text-sm text-gray-600 mt-4">
          Don’t have an account?{" "}
          <Link to="/register" className="text-indigo-600 hover:underline">
            Register here
          </Link>
        </p>
      </form>
    </div>
  );
};

export default Login;
