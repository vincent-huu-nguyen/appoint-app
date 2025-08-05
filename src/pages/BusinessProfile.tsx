import { useState } from "react";
import { auth, db } from "../firebase";
import { doc, updateDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

const BusinessProfile = () => {
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const navigate = useNavigate();
  const user = auth.currentUser;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    await updateDoc(doc(db, "users", user.uid), {
      name,
      businessName,
      phone,
    });

    navigate("/dashboard");
  };

  const formatPhoneNumber = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    const match = numbers.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);
    if (!match) return value;
    const [, area, prefix, line] = match;
    if (area && !prefix) return area;
    if (area && prefix && !line) return `${area}-${prefix}`;
    if (area && prefix && line) return `${area}-${prefix}-${line}`;
    return value;
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto mt-10 space-y-4">
      <h2 className="text-xl font-semibold text-center">Business Profile</h2>
      <input
        type="text"
        placeholder="Your Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="border p-2 w-full"
        required
      />
      <input
        type="text"
        placeholder="Business Name"
        value={businessName}
        onChange={(e) => setBusinessName(e.target.value)}
        className="border p-2 w-full"
        required
      />
      <input
        type="tel"
        placeholder="Phone Number"
        value={phone}
        onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
        className="border p-2 w-full"
        required
      />
      <button type="submit" className="bg-purple-600 text-white w-full py-2 rounded">
        Save Profile
      </button>
    </form>
  );
};

export default BusinessProfile;
