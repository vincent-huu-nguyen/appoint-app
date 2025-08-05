import { useEffect, useState } from "react";
import {
    collection,
    getDocs,
    query,
    where,
    doc,
    getDoc,
    setDoc,
} from "firebase/firestore";
import { auth, db, storage } from "../firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import profilePlaceholder from "../assets/profilePlaceholder.png";

const BusinessDashboard = () => {
    const user = auth.currentUser;
    const [appointments, setAppointments] = useState<any[]>([]);
    const [search, setSearch] = useState("");
    const [showProfile, setShowProfile] = useState(false);
    const [businessInfo, setBusinessInfo] = useState<any>(null);
    const [editingProfile, setEditingProfile] = useState(false);
    const [nameInput, setNameInput] = useState("");
    const [businessNameInput, setBusinessNameInput] = useState("");
    const [phoneInput, setPhoneInput] = useState("");
    const navigate = useNavigate();
    const [imageUpload, setImageUpload] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [editingApptId, setEditingApptId] = useState<string | null>(null);
    const [editedDate, setEditedDate] = useState("");
    const [editedTime, setEditedTime] = useState("");


    const formatPhoneNumber = (phone: string) => {
        const digits = phone.replace(/\D/g, "");
        const match = digits.match(/^(\d{3})(\d{3})(\d{4})$/);
        return match ? `${match[1]}-${match[2]}-${match[3]}` : phone;
    };

    useEffect(() => {
        const fetchAppointments = async () => {
            if (!user) return;
            const q = query(
                collection(db, "appointments"),
                where("businessId", "==", user.uid)
            );
            const snapshot = await getDocs(q);
            const data = await Promise.all(
                snapshot.docs.map(async (docSnap) => {
                    const appt = docSnap.data();
                    const customerRef = doc(db, "users", appt.customerId);
                    const customerSnap = await getDoc(customerRef);
                    const customerData = customerSnap.exists()
                        ? customerSnap.data()
                        : {};
                    return {
                        id: docSnap.id,
                        ...appt,
                        customerName: customerData.name || "Unknown",
                        customerPhone: customerData.phone || "N/A",
                    };
                })
            );
            setAppointments(data);
        };

        const fetchBusiness = async () => {
            if (!user) return;
            const ref = doc(db, "users", user.uid);
            const snap = await getDoc(ref);
            if (snap.exists()) {
                setBusinessInfo(snap.data());
            }
        };

        fetchAppointments();
        fetchBusiness();
    }, [user]);

    const filtered = appointments.filter((appt) =>
        appt.customerName.toLowerCase().includes(search.toLowerCase())
    );

    const handleUpdateAppointment = async (id: string) => {
        const apptRef = doc(db, "appointments", id);
        await setDoc(apptRef, { date: editedDate, time: editedTime }, { merge: true });

        // Refresh appointments
        const snapshot = await getDocs(
            query(collection(db, "appointments"), where("businessId", "==", user?.uid))
        );
        const data = await Promise.all(
            snapshot.docs.map(async (docSnap) => {
                const appt = docSnap.data();
                const customerRef = doc(db, "users", appt.customerId);
                const customerSnap = await getDoc(customerRef);
                const customerData = customerSnap.exists() ? customerSnap.data() : {};
                return {
                    id: docSnap.id,
                    ...appt,
                    customerName: customerData.name || "Unknown",
                    customerPhone: customerData.phone || "N/A",
                };
            })
        );
        setAppointments(data);
        setEditingApptId(null);
    };


    const handleSaveProfile = async () => {
        if (!user) return;
        await setDoc(
            doc(db, "users", user.uid),
            {
                name: nameInput,
                businessName: businessNameInput,
                phone: phoneInput,
                role: "admin",
                email: businessInfo?.email,
            },
            { merge: true }
        );
        const updatedSnap = await getDoc(doc(db, "users", user.uid));
        if (updatedSnap.exists()) setBusinessInfo(updatedSnap.data());
        setEditingProfile(false);
    };

    const handleImageUpload = async () => {
        if (!user || !imageUpload) return;
        setUploading(true);
        const imageRef = ref(storage, `profilePictures/${user.uid}`);
        await uploadBytes(imageRef, imageUpload);
        const url = await getDownloadURL(imageRef);
        await setDoc(doc(db, "users", user.uid), { profilePicture: url }, { merge: true });
        const updatedSnap = await getDoc(doc(db, "users", user.uid));
        if (updatedSnap.exists()) setBusinessInfo(updatedSnap.data());
        setImageUpload(null);
        setUploading(false);
    };

    const handleLogout = async () => {
        await signOut(auth);
        setTimeout(() => {
            navigate("/");
        }, 50);
    };

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="flex justify-between items-center gap-4 mb-6">
                <h1 className="text-2xl font-semibold">
                    {showProfile ? "Your Profile" : "Your Appointments"}
                </h1>
                <button
                    onClick={() => setShowProfile((prev) => !prev)}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                    {showProfile ? "View Your Appointments" : "View My Profile"}
                </button>
                <button
                    onClick={handleLogout}
                    className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                >
                    Logout
                </button>
            </div>

            {showProfile ? (
                <div className="flex justify-center">
                    <div className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-md text-center border">
                        <img
                            src={businessInfo?.profilePicture || profilePlaceholder}
                            alt="Profile"
                            className="w-32 h-32 object-cover rounded-full bg-gray-200 mx-auto mb-4"
                        />

                        {editingProfile && (
                            <div className="mb-4">
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => setImageUpload(e.target.files?.[0] || null)}
                                    className="mb-2"
                                />
                                <button
                                    onClick={handleImageUpload}
                                    disabled={!imageUpload || uploading}
                                    className="bg-indigo-600 text-white px-4 py-1 rounded disabled:opacity-50"
                                >
                                    {uploading ? "Uploading..." : "Upload Picture"}
                                </button>
                            </div>
                        )}

                        {editingProfile ? (
                            <div className="space-y-4 mt-4 text-center">
                                <input
                                    type="text"
                                    placeholder="Your Name"
                                    value={nameInput}
                                    onChange={(e) => setNameInput(e.target.value)}
                                    className="border p-2 w-full rounded"
                                />
                                <input
                                    type="text"
                                    placeholder="Business Name"
                                    value={businessNameInput}
                                    onChange={(e) => setBusinessNameInput(e.target.value)}
                                    className="border p-2 w-full rounded"
                                />
                                <input
                                    type="tel"
                                    placeholder="Phone Number"
                                    value={phoneInput}
                                    onChange={(e) => setPhoneInput(e.target.value)}
                                    className="border p-2 w-full rounded"
                                />
                                <div className="flex gap-4 justify-center">
                                    <button
                                        onClick={handleSaveProfile}
                                        className="bg-green-600 text-white px-4 py-2 rounded"
                                    >
                                        Save
                                    </button>
                                    <button
                                        onClick={() => setEditingProfile(false)}
                                        className="bg-gray-400 text-white px-4 py-2 rounded"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2 mt-4 text-center">
                                <h2 className="text-2xl font-bold text-gray-800 mb-1">{businessInfo?.businessName}</h2>

                                <p className="text-gray-600 mb-1">
                                    <span className="font-semibold">Owner:</span> {businessInfo?.name || "N/A"}
                                </p>
                                <p className="text-gray-600 mb-4">
                                    <span className="font-semibold">Phone:</span>{" "}
                                    {formatPhoneNumber(businessInfo?.phone || "")}
                                </p>
                            </div>
                        )}

                        {!editingProfile && (
                            <div className="mt-6">
                                <button
                                    onClick={() => {
                                        setEditingProfile(true);
                                        setNameInput(businessInfo?.name || "");
                                        setBusinessNameInput(businessInfo?.businessName || "");
                                        setPhoneInput(businessInfo?.phone || "");
                                    }}
                                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                                >
                                    Edit Profile
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <>
                    <input
                        type="text"
                        placeholder="Search by customer name..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full border p-2 rounded mb-6"
                    />
                    {filtered.length === 0 ? (
                        <p className="text-gray-600">No appointments found.</p>
                    ) : (
                        <ul className="space-y-4">
                            {filtered.map((appt) => (
                                <li key={appt.id} className="border p-4 rounded shadow bg-white">
                                    <p className="font-semibold">Customer: {appt.customerName}</p>
                                    <p>Phone: {formatPhoneNumber(appt.customerPhone)}</p>

                                    {editingApptId === appt.id ? (
                                        <>
                                            <div className="flex gap-2 mt-2">
                                                <input
                                                    type="date"
                                                    value={editedDate}
                                                    onChange={(e) => setEditedDate(e.target.value)}
                                                    className="border p-1 rounded"
                                                />
                                                <input
                                                    type="time"
                                                    value={editedTime}
                                                    onChange={(e) => setEditedTime(e.target.value)}
                                                    className="border p-1 rounded"
                                                />
                                            </div>
                                            <div className="flex gap-2 mt-2">
                                                <button
                                                    onClick={() => handleUpdateAppointment(appt.id)}
                                                    className="bg-green-600 text-white px-3 py-1 rounded"
                                                >
                                                    Save
                                                </button>
                                                <button
                                                    onClick={() => setEditingApptId(null)}
                                                    className="bg-gray-500 text-white px-3 py-1 rounded"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <p>
                                                Date:{" "}
                                                {new Date(appt.date).toLocaleDateString("en-US", {
                                                    weekday: "long",
                                                    year: "numeric",
                                                    month: "2-digit",
                                                    day: "2-digit",
                                                })}
                                            </p>
                                            <p>
                                                Time:{" "}
                                                {new Date(`1970-01-01T${appt.time}`).toLocaleTimeString("en-US", {
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                    hour12: true,
                                                })}
                                            </p>
                                            <button
                                                onClick={() => {
                                                    setEditingApptId(appt.id);
                                                    setEditedDate(appt.date);
                                                    setEditedTime(appt.time);
                                                }}
                                                className="mt-2 bg-blue-600 text-white px-3 py-1 rounded"
                                            >
                                                Edit
                                            </button>
                                        </>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            )}
        </div>
    );
};

export default BusinessDashboard;
