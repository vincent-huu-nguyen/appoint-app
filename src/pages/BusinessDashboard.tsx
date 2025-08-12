import { useEffect, useState } from "react";
import {
    collection,
    getDocs,
    query,
    where,
    doc,
    getDoc,
    setDoc,
    deleteDoc,
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
    const [descriptionInput, setDescriptionInput] = useState("");
    const [services, setServices] = useState<{ name: string; price: number; duration: number }[]>([]);
    const [newServiceName, setNewServiceName] = useState("");
    const [newServicePrice, setNewServicePrice] = useState("");
    const [newServiceDuration, setNewServiceDuration] = useState("");
    const [editingServiceIndex, setEditingServiceIndex] = useState<number | null>(null);
    const [editedService, setEditedService] = useState<{ name: string; price: number; duration: number }>({
        name: "",
        price: 0,
        duration: 0,
    });
    const toLocalDate = (yyyymmdd: string) => {
        const [y, m, d] = yyyymmdd.split("-").map(Number);
        return new Date(y, m - 1, d); // local midnight
    };
    const [deletingId, setDeletingId] = useState<string | null>(null);


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
                const data = snap.data();
                setBusinessInfo(data);
                setServices(data.services || []);
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

    const handleDeleteAppointment = async (id: string) => {
        if (!user) return;
        const yes = window.confirm("Delete this appointment? This cannot be undone.");
        if (!yes) return;

        try {
            setDeletingId(id);
            await deleteDoc(doc(db, "appointments", id));
            // Optimistically update UI
            setAppointments(prev => prev.filter(a => a.id !== id));
        } finally {
            setDeletingId(null);
        }
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
                description: descriptionInput,
                services,
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
                <div>
                    <button
                        onClick={() => setShowProfile((prev) => !prev)}
                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                    >
                        {showProfile ? "View Your Appointments" : "View My Profile"}
                    </button>
                    <button
                        onClick={handleLogout}
                        className="bg-red-600 text-white px-4 py-2 ml-2 rounded hover:bg-red-700"
                    >
                        Logout
                    </button>
                </div>
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
                                <textarea
                                    placeholder="Description"
                                    value={descriptionInput}
                                    onChange={(e) => setDescriptionInput(e.target.value)}
                                    className="border p-2 w-full rounded h-24 resize-none"
                                />
                                <div className="space-y-2 text-left">
                                    <h3 className="text-lg font-semibold">Services</h3>
                                    {services.map((service, idx) => (
                                        <div key={idx} className="flex gap-2 text-sm items-center">
                                            {editingServiceIndex === idx ? (
                                                <>
                                                    <input
                                                        type="text"
                                                        value={editedService.name}
                                                        onChange={(e) => setEditedService({ ...editedService, name: e.target.value })}
                                                        className="border p-1 rounded w-1/3"
                                                    />
                                                    <input
                                                        type="number"
                                                        value={editedService.price}
                                                        onChange={(e) => setEditedService({ ...editedService, price: parseFloat(e.target.value) })}
                                                        className="border p-1 rounded w-1/3"
                                                    />
                                                    <input
                                                        type="number"
                                                        value={editedService.duration}
                                                        onChange={(e) => setEditedService({ ...editedService, duration: parseInt(e.target.value) })}
                                                        className="border p-1 rounded w-1/3"
                                                    />
                                                    <button
                                                        className="text-green-600 text-xs font-medium"
                                                        onClick={() => {
                                                            const updated = [...services];
                                                            updated[idx] = editedService;
                                                            setServices(updated);
                                                            setEditingServiceIndex(null);
                                                        }}
                                                    >
                                                        Save
                                                    </button>
                                                    <button
                                                        className="text-gray-500 text-xs font-medium"
                                                        onClick={() => setEditingServiceIndex(null)}
                                                    >
                                                        Cancel
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <span className="w-1/3">{service.name}</span>
                                                    <span className="w-1/3">${service.price.toFixed(2)}</span>
                                                    <span className="w-1/3">{service.duration} min</span>
                                                    <button
                                                        className="text-blue-600 text-xs font-medium"
                                                        onClick={() => {
                                                            setEditingServiceIndex(idx);
                                                            setEditedService(service);
                                                        }}
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        className="text-red-600 text-xs font-medium"
                                                        onClick={() => {
                                                            const updated = services.filter((_, i) => i !== idx);
                                                            setServices(updated);
                                                        }}
                                                    >
                                                        Delete
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    ))}

                                    <div className="flex gap-2 mt-2">
                                        <input
                                            type="text"
                                            placeholder="Service Name"
                                            value={newServiceName}
                                            onChange={(e) => setNewServiceName(e.target.value)}
                                            className="border p-2 rounded w-1/3"
                                        />
                                        <input
                                            type="number"
                                            placeholder="Price"
                                            value={newServicePrice}
                                            onChange={(e) => setNewServicePrice(e.target.value)}
                                            className="border p-2 rounded w-1/3"
                                        />
                                        <input
                                            type="number"
                                            placeholder="Duration (min)"
                                            value={newServiceDuration}
                                            onChange={(e) => setNewServiceDuration(e.target.value)}
                                            className="border p-2 rounded w-1/3"
                                        />
                                    </div>
                                    <button
                                        onClick={() => {
                                            if (!newServiceName || !newServicePrice || !newServiceDuration) return;
                                            setServices([
                                                ...services,
                                                {
                                                    name: newServiceName,
                                                    price: parseFloat(newServicePrice),
                                                    duration: parseInt(newServiceDuration),
                                                },
                                            ]);
                                            setNewServiceName("");
                                            setNewServicePrice("");
                                            setNewServiceDuration("");
                                        }}
                                        className="mt-2 bg-blue-600 text-white px-3 py-1 rounded"
                                    >
                                        Add Service
                                    </button>
                                </div>

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
                            <>
                                <div className="space-y-2 mt-4 text-center">
                                    <h2 className="text-2xl font-bold text-gray-800 mb-1">{businessInfo?.businessName}</h2>
                                    <p className="text-gray-600 mb-1">
                                        <span className="font-bold">Owner:</span> {businessInfo?.name || "N/A"}
                                    </p>
                                    <p className="text-gray-600 mb-4">
                                        <span className="font-bold">Phone:</span>{" "}
                                        {formatPhoneNumber(businessInfo?.phone || "")}
                                    </p>
                                    <p className="text-gray-600 pt-2">
                                        {businessInfo?.description || "N/A"}
                                    </p>
                                </div>

                                {services.length > 0 && (
                                    <div className="mt-4 text-left">
                                        <h3 className="text-gray-700 font-bold pt-5 mb-2 text-center">Services Offered:</h3>
                                        <div className="mt-4">
                                            {/* Header row */}
                                            <div className="grid grid-cols-3 font-semibold text-sm border-b pb-1 mb-2 text-center">
                                                <span>Service</span>
                                                <span>Price</span>
                                                <span>Duration</span>
                                            </div>

                                            {/* Data rows */}
                                            <ul className="space-y-1">
                                                {services.map((s, i) => (
                                                    <li
                                                        key={i}
                                                        className="grid grid-cols-3 text-gray-700 text-sm border-b py-1 text-center"
                                                    >
                                                        <span>{s.name}</span>
                                                        <span>${s.price.toFixed(2)}</span>
                                                        <span>{s.duration} min</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>

                                    </div>
                                )}
                            </>

                        )}

                        {!editingProfile && (
                            <div className="mt-6">
                                <button
                                    onClick={() => {
                                        setEditingProfile(true);
                                        setNameInput(businessInfo?.name || "");
                                        setBusinessNameInput(businessInfo?.businessName || "");
                                        setPhoneInput(businessInfo?.phone || "");
                                        setDescriptionInput(businessInfo?.description || "");
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
                                                Date: {toLocalDate(appt.date).toLocaleDateString("en-US", {
                                                    weekday: "long",
                                                    year: "numeric",
                                                    month: "2-digit",
                                                    day: "2-digit",
                                                })}

                                            </p>
                                            <p>Time: {appt.time}</p>

                                            {typeof appt.note === "string" && appt.note.trim() !== "" && (
                                                <p className="mt-2 text-gray-700">
                                                    <span className="font-semibold">Note:</span>{" "}
                                                    <span className="whitespace-pre-wrap">{appt.note}</span>
                                                </p>
                                            )}

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
                                            <button
                                                onClick={() => handleDeleteAppointment(appt.id)}
                                                disabled={deletingId === appt.id}
                                                className={`mt-2 ml-2 px-3 py-1 rounded text-white ${deletingId === appt.id ? "bg-red-400 cursor-not-allowed" : "bg-red-600 hover:bg-red-700"
                                                    }`}
                                            >
                                                {deletingId === appt.id ? "Deleting..." : "Delete"}
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
