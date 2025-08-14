import { useEffect, useState, useRef } from "react";
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
import {
    ref as storageRef,
    deleteObject,
    listAll,
    uploadBytes,
    getDownloadURL,
} from "firebase/storage";
import {
    signOut,
    deleteUser,
    reauthenticateWithCredential,
    EmailAuthProvider,
    reauthenticateWithPopup,
    GoogleAuthProvider,
} from "firebase/auth";
import { useNavigate } from "react-router-dom";
import profilePlaceholder from "../assets/profilePlaceholder.png";
import AvailabilityEditor from "../components/AvailabilityEditor";
import { Availability, defaultAvailability } from "../utils/availability";

/* ----------------------------- Types & Helpers ---------------------------- */

type Appt = {
    id: string;
    date: string; // "YYYY-MM-DD"
    time: string; // "h:mm AM/PM" or "HH:mm"
    customerId: string;
    businessId: string;
    businessName: string;
    businessPhone: string;
    service: string;
    duration: number;
    note?: string | null;
    customerName?: string;
    customerPhone?: string;
    status?: string;
    active?: boolean;
};

type Service = {
    name: string;
    price: number;
    duration: number;
    /** If true, display price as "$X.XX+" (starting at) */
    pricePlus?: boolean;
};

const toLocalDate = (yyyymmdd: string) => {
    const [y, m, d] = yyyymmdd.split("-").map(Number);
    return new Date(y, m - 1, d); // local midnight
};

const parseMinutes = (t: string) => {
    // supports "h:mm AM/PM" or "HH:mm"
    const m12 = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (m12) {
        let h = parseInt(m12[1], 10);
        const m = parseInt(m12[2], 10);
        const ampm = m12[3].toUpperCase();
        if (ampm === "PM" && h !== 12) h += 12;
        if (ampm === "AM" && h === 12) h = 0;
        return h * 60 + m;
    }
    const m24 = t.match(/^(\d{1,2}):(\d{2})$/);
    if (m24) return parseInt(m24[1], 10) * 60 + parseInt(m24[2], 10);
    return 0;
};

const apptTimestamp = (a: { date: string; time: string }) => {
    const [y, m, d] = a.date.split("-").map(Number);
    const minutes = parseMinutes(a.time);
    const base = new Date(y, m - 1, d);
    base.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    return base.getTime();
};

const formatPhoneNumber = (phone: string) => {
    const digits = phone.replace(/\D/g, "");
    const match = digits.match(/^(\d{3})(\d{3})(\d{4})$/);
    return match ? `${match[1]}-${match[2]}-${match[3]}` : phone;
};

/* ------------------------------- Component -------------------------------- */

const BusinessDashboard = () => {
    const user = auth.currentUser;
    const navigate = useNavigate();

    const [appointments, setAppointments] = useState<Appt[]>([]);
    const [search, setSearch] = useState("");
    const [showProfile, setShowProfile] = useState(false);
    const [businessInfo, setBusinessInfo] = useState<any>(null);

    const [editingProfile, setEditingProfile] = useState(false);
    const [nameInput, setNameInput] = useState("");
    const [businessNameInput, setBusinessNameInput] = useState("");
    const [phoneInput, setPhoneInput] = useState("");
    const [descriptionInput, setDescriptionInput] = useState("");

    // New availability note state
    const [availabilityNote, setAvailabilityNote] = useState("");

    // Refs for auto-resizing textareas
    const descRef = useRef<HTMLTextAreaElement>(null);
    const availRef = useRef<HTMLTextAreaElement>(null);

    const autoResize = (el: HTMLTextAreaElement | null) => {
        if (!el) return;
        el.style.height = "auto";
        el.style.height = el.scrollHeight + "px";
    };

    // Adjust heights when text changes or when entering edit mode
    useEffect(() => {
        if (editingProfile) {
            autoResize(descRef.current);
            autoResize(availRef.current);
        }
    }, [descriptionInput, availabilityNote, editingProfile]);

    const [services, setServices] = useState<Service[]>([]);
    const [newServiceName, setNewServiceName] = useState("");
    const [newServicePrice, setNewServicePrice] = useState("");
    const [newServiceDuration, setNewServiceDuration] = useState("");
    const [newServicePlus, setNewServicePlus] = useState(false);

    const [editingServiceIndex, setEditingServiceIndex] = useState<number | null>(null);
    const [editedService, setEditedService] = useState<Service>({
        name: "",
        price: 0,
        duration: 0,
        pricePlus: false,
    });

    const [imageUpload, setImageUpload] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);

    const [editingApptId, setEditingApptId] = useState<string | null>(null);
    const [editedDate, setEditedDate] = useState("");
    const [editedTime, setEditedTime] = useState("");

    const [deletingId, setDeletingId] = useState<string | null>(null);

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deletingAccount, setDeletingAccount] = useState(false);
    const [confirmText, setConfirmText] = useState("");

    const [availability, setAvailability] = useState<Availability>(defaultAvailability());

    /* ---------------------------- Load data on mount --------------------------- */

    useEffect(() => {
        const fetchAppointments = async () => {
            if (!user) return;
            const qy = query(collection(db, "appointments"), where("businessId", "==", user.uid));
            const snapshot = await getDocs(qy);

            const data: Appt[] = await Promise.all(
                snapshot.docs.map(async (docSnap) => {
                    const appt = docSnap.data() as Omit<Appt, "id" | "customerName" | "customerPhone">;
                    const customerRef = doc(db, "users", appt.customerId);
                    const customerSnap = await getDoc(customerRef);
                    const customerData = customerSnap.exists() ? (customerSnap.data() as any) : {};
                    return {
                        id: docSnap.id,
                        ...appt,
                        customerName: customerData.name || "Unknown",
                        customerPhone: customerData.phone || "N/A",
                    };
                })
            );

            data.sort((a, b) => apptTimestamp(a) - apptTimestamp(b));
            setAppointments(data);
        };

        const fetchBusiness = async () => {
            if (!user) return;
            const ref = doc(db, "users", user.uid);
            const snap = await getDoc(ref);
            if (snap.exists()) {
                const data = snap.data() as any;
                setBusinessInfo(data);

                const svcs: Service[] = (data.services || []).map((s: any) => ({
                    name: s.name,
                    price: s.price,
                    duration: s.duration,
                    pricePlus: !!s.pricePlus,
                }));
                setServices(svcs);

                setAvailability(
                    data.availability && data.availability.weekly && data.availability.blackoutDates
                        ? data.availability
                        : defaultAvailability()
                );

                // hydrate text fields from Firestore
                setDescriptionInput(data.description || "");
                setAvailabilityNote(data.availabilityNote || "");
            }
        };

        fetchAppointments();
        fetchBusiness();
    }, [user]);

    /* ------------------------------- Handlers -------------------------------- */

    const handleUpdateAppointment = async (id: string) => {
        const apptRef = doc(db, "appointments", id);
        await setDoc(apptRef, { date: editedDate, time: editedTime }, { merge: true });

        if (!user) return;
        const snapshot = await getDocs(
            query(collection(db, "appointments"), where("businessId", "==", user.uid))
        );
        const data: Appt[] = await Promise.all(
            snapshot.docs.map(async (docSnap) => {
                const appt = docSnap.data() as Omit<Appt, "id" | "customerName" | "customerPhone">;
                const customerRef = doc(db, "users", appt.customerId);
                const customerSnap = await getDoc(customerRef);
                const customerData = customerSnap.exists() ? (customerSnap.data() as any) : {};
                return {
                    id: docSnap.id,
                    ...appt,
                    customerName: customerData.name || "Unknown",
                    customerPhone: customerData.phone || "N/A",
                };
            })
        );
        data.sort((a, b) => apptTimestamp(a) - apptTimestamp(b));
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
            setAppointments((prev) => prev.filter((a) => a.id !== id));
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
                availabilityNote, // NEW
                services, // includes pricePlus
                availability,
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
        const imageRef = storageRef(storage, `profilePictures/${user.uid}`);
        await uploadBytes(imageRef, imageUpload);
        const url = await getDownloadURL(imageRef);
        await setDoc(doc(db, "users", user.uid), { profilePicture: url }, { merge: true });
        const updatedSnap = await getDoc(doc(db, "users", user.uid));
        if (updatedSnap.exists()) setBusinessInfo(updatedSnap.data());
        setImageUpload(null);
        setUploading(false);
    };

    const handleDeleteAccount = async () => {
        if (!user) return;

        try {
            setDeletingAccount(true);

            // 1) Delete all appointments for this business
            const apptSnap = await getDocs(
                query(collection(db, "appointments"), where("businessId", "==", user.uid))
            );
            await Promise.all(apptSnap.docs.map((d) => deleteDoc(doc(db, "appointments", d.id))));

            // 2) Delete Storage assets
            try {
                const fileRef = storageRef(storage, `profilePictures/${user.uid}`);
                await deleteObject(fileRef);
            } catch {
                try {
                    const dirRef = storageRef(storage, `profilePictures/${user.uid}/`);
                    const listed = await listAll(dirRef);
                    await Promise.all(listed.items.map((item) => deleteObject(item)));
                } catch {
                    /* ignore if none */
                }
            }

            // 3) Delete Firestore user doc
            await deleteDoc(doc(db, "users", user.uid));

            // 4) Delete auth user (reauth if needed)
            try {
                await deleteUser(user);
            } catch (err: any) {
                if (err?.code === "auth/requires-recent-login") {
                    const providerId = user.providerData[0]?.providerId;
                    if (providerId === "password") {
                        const email = user.email || "";
                        const password =
                            window.prompt("For security, please re-enter your password to delete your account:") ||
                            "";
                        if (!password) throw err;
                        const cred = EmailAuthProvider.credential(email, password);
                        await reauthenticateWithCredential(user, cred);
                    } else {
                        await reauthenticateWithPopup(user, new GoogleAuthProvider());
                    }
                    await deleteUser(user);
                } else {
                    throw err;
                }
            }

            // 5) Sign out & redirect
            await signOut(auth);
            navigate("/");
        } catch (e) {
            console.error(e);
            alert("Sorry—account deletion failed. Please try again.");
        } finally {
            setDeletingAccount(false);
        }
    };

    // NEW: mark appointment as completed (don’t delete)
    const handleCompleteAppointment = async (id: string) => {
        try {
            await setDoc(
                doc(db, "appointments", id),
                {
                    status: "completed",
                    active: false,
                    completedAt: new Date().toISOString(),
                },
                { merge: true }
            );
            // Optimistic update
            setAppointments((prev) =>
                prev.map((a) => (a.id === id ? { ...a, status: "completed", active: false } : a))
            );
        } catch (e) {
            console.error(e);
            alert("Could not mark as completed. Please try again.");
        }
    };

    const handleLogout = async () => {
        await signOut(auth);
        setTimeout(() => navigate("/"), 50);
    };

    /* --------------------------------- Render -------------------------------- */

    const nowTs = Date.now();

    const filtered = appointments
        .slice()
        .sort((a, b) => apptTimestamp(a) - apptTimestamp(b))
        .filter((appt) => {
            const ts = apptTimestamp(appt);
            const isFuture = ts >= nowTs;
            const isCompleted = appt.active === false || appt.status === "completed";
            // show future OR (past and not completed)
            return isFuture || (!isFuture && !isCompleted);
        })
        .filter((appt) =>
            (appt.customerName || "").toLowerCase().includes(search.toLowerCase())
        );

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="flex justify-between items-center gap-4 mb-6">
                <h1 className="text-2xl font-semibold">
                    {showProfile ? "Your Profile" : "Your Appointments"}
                </h1>
                <div className="flex">
                    <button
                        onClick={() => setShowProfile((prev) => !prev)}
                        className="bg-indigo-800 text-white px-4 py-2 rounded hover:bg-indigo-900"
                    >
                        {showProfile ? "View Your Appointments" : "View My Profile"}
                    </button>
                    <button
                        onClick={handleLogout}
                        className="bg-gray-800 text-white px-4 py-2 ml-2 rounded hover:bg-gray-900"
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
                            <div className="text-left">
                                <p className="mt-4">Name</p>
                                <input
                                    type="text"
                                    placeholder="Your Name"
                                    value={nameInput}
                                    onChange={(e) => setNameInput(e.target.value)}
                                    className="border p-2 w-full rounded"
                                />

                                <p className="mt-4">Business Name</p>
                                <input
                                    type="text"
                                    placeholder="Business Name"
                                    value={businessNameInput}
                                    onChange={(e) => setBusinessNameInput(e.target.value)}
                                    className="border p-2 w-full rounded"
                                />

                                <p className="mt-4">Phone Number</p>
                                <input
                                    type="tel"
                                    placeholder="Phone Number"
                                    value={phoneInput}
                                    onChange={(e) => setPhoneInput(e.target.value)}
                                    className="border p-2 w-full rounded"
                                />

                                <p className="mt-4">Description</p>
                                <textarea
                                    ref={descRef}
                                    placeholder="Description"
                                    value={descriptionInput}
                                    onChange={(e) => setDescriptionInput(e.target.value)}
                                    className="border p-2 w-full rounded resize-none overflow-hidden"
                                    style={{ minHeight: "6rem" }}
                                />

                                <p className="mt-4">Special Notes</p>
                                <textarea
                                    ref={availRef}
                                    placeholder="Anything customers should know about your hours, exceptions, closures, deals…"
                                    value={availabilityNote}
                                    onChange={(e) => setAvailabilityNote(e.target.value)}
                                    className="border p-2 w-full rounded resize-none overflow-hidden mb-8"
                                    style={{ minHeight: "6rem" }}
                                />

                                <div className="space-y-2 text-left border-t border-b border-gray-300 py-8">
                                    <h3 className="text-lg font-semibold">Services</h3>

                                    {services.map((service, idx) => (
                                        <div key={idx} className="flex gap-2 text-sm items-center">
                                            {editingServiceIndex === idx ? (
                                                <>
                                                    <input
                                                        type="text"
                                                        value={editedService.name}
                                                        onChange={(e) =>
                                                            setEditedService({ ...editedService, name: e.target.value })
                                                        }
                                                        className="border p-1 rounded w-1/4"
                                                        placeholder="Name"
                                                    />
                                                    <input
                                                        type="number"
                                                        value={
                                                            Number.isFinite(editedService.price) ? editedService.price : 0
                                                        }
                                                        onChange={(e) =>
                                                            setEditedService({
                                                                ...editedService,
                                                                price: parseFloat(e.target.value || "0"),
                                                            })
                                                        }
                                                        className="border p-1 rounded w-1/4"
                                                        placeholder="Price"
                                                    />
                                                    <input
                                                        type="number"
                                                        value={editedService.duration}
                                                        onChange={(e) =>
                                                            setEditedService({
                                                                ...editedService,
                                                                duration: parseInt(e.target.value || "0", 10),
                                                            })
                                                        }
                                                        className="border p-1 rounded w-1/4"
                                                        placeholder="Duration"
                                                    />
                                                    <label className="inline-flex items-center gap-1 w-1/4">
                                                        <input
                                                            type="checkbox"
                                                            checked={!!editedService.pricePlus}
                                                            onChange={(e) =>
                                                                setEditedService({
                                                                    ...editedService,
                                                                    pricePlus: e.target.checked,
                                                                })
                                                            }
                                                        />
                                                        <span className="text-xs">Show as “starting at” (+)</span>
                                                    </label>

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
                                                    <span className="w-1/4">{service.name}</span>
                                                    <span className="w-1/4">
                                                        ${service.price.toFixed(2)}
                                                        {service.pricePlus ? "+" : ""}
                                                    </span>
                                                    <span className="w-1/4">{service.duration} min</span>
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

                                    <div className="flex justify-between flex-wrap gap-2 mt-2 items-center">
                                        <input
                                            type="text"
                                            placeholder="Service Name"
                                            value={newServiceName}
                                            onChange={(e) => setNewServiceName(e.target.value)}
                                            className="text-sm border p-2 rounded w-1/3 min-w-[140px]"
                                        />
                                        <div className="flex">
                                            <p className="py-2 pr-1">$</p>
                                            <input
                                                type="number"
                                                placeholder="Price"
                                                value={newServicePrice}
                                                onChange={(e) => setNewServicePrice(e.target.value)}
                                                className="text-sm border p-2 rounded w-1/4 min-w-[126px]"
                                            />
                                            <label className="inline-flex items-center gap-2 ml-2">
                                                <input
                                                    type="checkbox"
                                                    checked={newServicePlus}
                                                    onChange={(e) => setNewServicePlus(e.target.checked)}
                                                />
                                                <span className="text-xs">Show price as “starting at” (+)</span>
                                            </label>
                                        </div>
                                        <div className="flex">
                                            <input
                                                type="number"
                                                placeholder="Duration (min)"
                                                value={newServiceDuration}
                                                onChange={(e) => setNewServiceDuration(e.target.value)}
                                                className="text-sm border p-2 rounded w-1/4 min-w-[140px]"
                                            />
                                            <p className="py-2 pl-1">min</p>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => {
                                            if (!newServiceName || !newServicePrice || !newServiceDuration) return;
                                            setServices([
                                                ...services,
                                                {
                                                    name: newServiceName,
                                                    price: parseFloat(newServicePrice),
                                                    duration: parseInt(newServiceDuration, 10),
                                                    pricePlus: newServicePlus,
                                                },
                                            ]);
                                            setNewServiceName("");
                                            setNewServicePrice("");
                                            setNewServiceDuration("");
                                            setNewServicePlus(false);
                                        }}
                                        className="mt-2 bg-gray-700 hover:bg-gray-800 text-white px-3 py-1 rounded"
                                    >
                                        Add Service
                                    </button>
                                </div>

                                <AvailabilityEditor value={availability} onChange={setAvailability} />

                                <div className="flex gap-4 justify-center mt-8">
                                    <button
                                        onClick={handleSaveProfile}
                                        className="bg-indigo-700 hover:bg-indigo-800 text-white px-4 py-2 rounded"
                                    >
                                        Save
                                    </button>
                                    <button
                                        onClick={() => setEditingProfile(false)}
                                        className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-2 mt-4 text-center">
                                    <h2 className="text-2xl font-bold text-gray-800 mb-1">
                                        {businessInfo?.businessName}
                                    </h2>
                                    <p className="text-gray-600 mb-1">
                                        <span className="font-bold">Owner:</span> {businessInfo?.name || "N/A"}
                                    </p>
                                    <p className="text-gray-600 mb-4">
                                        <span className="font-bold">Phone:</span>{" "}
                                        {formatPhoneNumber(businessInfo?.phone || "")}
                                    </p>
                                    <p className="text-gray-700 pt-2 whitespace-pre-wrap">
                                        {businessInfo?.description || "N/A"}
                                    </p>

                                    {businessInfo?.availabilityNote && (
                                        <div className="mt-4 text-center border-t border-gray-300 pt-4">
                                            <h4 className="text-sm font-semibold text-gray-700 mb-1">
                                                Special Notes
                                            </h4>
                                            <p className="text-gray-700 whitespace-pre-wrap">
                                                {businessInfo.availabilityNote}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {services.length > 0 && (
                                    <div className="mt-4 text-left border-t border-gray-300 py-4">
                                        <h3 className="text-gray-700 font-bold mb-2 text-center">Services Offered:</h3>
                                        <div className="mt-4">
                                            <div className="grid grid-cols-3 font-semibold text-sm border-b pb-1 mb-2 text-center">
                                                <span>Service</span>
                                                <span>Price</span>
                                                <span>Duration</span>
                                            </div>
                                            <ul className="space-y-1">
                                                {services.map((s, i) => (
                                                    <li
                                                        key={i}
                                                        className="grid grid-cols-3 text-gray-700 text-sm border-b py-1 text-center"
                                                    >
                                                        <span>{s.name}</span>
                                                        <span>
                                                            ${s.price.toFixed(2)}
                                                            {s.pricePlus ? "+" : ""}
                                                        </span>
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
                                        setAvailabilityNote(businessInfo?.availabilityNote || ""); // hydrate
                                    }}
                                    className="bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-800"
                                >
                                    Edit Profile
                                </button>
                            </div>
                        )}

                        {!editingProfile && (
                            <div className="mt-4">
                                <button
                                    onClick={() => setShowDeleteConfirm(true)}
                                    className="bg-red-700 text-white px-4 py-2 rounded hover:bg-red-800"
                                >
                                    Delete Account
                                </button>
                            </div>
                        )}

                        {showDeleteConfirm && (
                            <div className="mt-3 p-3 border rounded bg-red-50 text-left">
                                <p className="text-sm text-red-800">
                                    This will permanently delete your profile, your profile picture, and all of your
                                    appointments. Type{" "}
                                    <span className="font-semibold">
                                        {businessInfo?.businessName || "DELETE"}
                                    </span>{" "}
                                    to confirm.
                                </p>
                                <input
                                    type="text"
                                    value={confirmText}
                                    onChange={(e) => setConfirmText(e.target.value)}
                                    className="mt-2 w-full border p-2 rounded"
                                    placeholder={`Type "${businessInfo?.businessName || "DELETE"}"`}
                                />
                                <div className="mt-2 flex gap-2">
                                    <button
                                        onClick={handleDeleteAccount}
                                        disabled={
                                            deletingAccount ||
                                            (businessInfo?.businessName
                                                ? confirmText !== businessInfo.businessName
                                                : confirmText !== "DELETE")
                                        }
                                        className={`px-3 py-1 rounded text-white ${
                                            deletingAccount ? "bg-red-400 cursor-not-allowed" : "bg-red-600 hover:bg-red-700"
                                        }`}
                                    >
                                        {deletingAccount ? "Deleting…" : "Confirm Delete"}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowDeleteConfirm(false);
                                            setConfirmText("");
                                        }}
                                        className="px-3 py-1 rounded bg-gray-200"
                                    >
                                        Cancel
                                    </button>
                                </div>
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

                    {/* below the search input */}
                    <div className="flex flex-wrap gap-3 mb-6">
                        <button
                            onClick={() => navigate("/dashboard/create-appointment")}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded"
                        >
                            Create an Appointment
                        </button>

                        <button
                            onClick={() => navigate("/dashboard/appointments/past")}
                            className="bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded"
                        >
                            View Past Appointments
                        </button>
                    </div>

                    {filtered.length === 0 ? (
                        <p className="text-gray-600">No appointments found.</p>
                    ) : (
                        <ul className="space-y-4">
                            {filtered.map((appt) => {
                                const isPast = apptTimestamp(appt) < Date.now();
                                const isCompleted = appt.active === false || appt.status === "completed";

                                return (
                                    <li
                                        key={appt.id}
                                        className={`border p-4 rounded shadow ${
                                            isPast ? "bg-gray-300" : "bg-white"
                                        }`}
                                    >
                                        <p className="font-semibold">Customer: {appt.customerName}</p>
                                        <p>Phone: {formatPhoneNumber(appt.customerPhone || "")}</p>

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
                                                        className="bg-indigo-800 hover:bg-indigo-900 text-white px-3 py-1 rounded"
                                                    >
                                                        Save
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingApptId(null)}
                                                        className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <p>
                                                    Date:{" "}
                                                    {toLocalDate(appt.date).toLocaleDateString("en-US", {
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
                                                    onClick={() => navigate(`/dashboard/create-appointment/${appt.id}`)}
                                                    className="mt-2 bg-indigo-800 hover:bg-indigo-900 text-white px-3 py-1 rounded"
                                                >
                                                    Edit
                                                </button>

                                                <button
                                                    onClick={() => handleDeleteAppointment(appt.id)}
                                                    disabled={deletingId === appt.id}
                                                    className={`mt-2 ml-2 px-3 py-1 rounded text-white ${
                                                        deletingId === appt.id
                                                            ? "bg-gray-700 cursor-not-allowed"
                                                            : "bg-gray-700 hover:bg-red-900"
                                                    }`}
                                                >
                                                    {deletingId === appt.id ? "Deleting..." : "Delete"}
                                                </button>

                                                {/* NEW: Complete button for past, not-yet-completed appts */}
                                                {isPast && !isCompleted && (
                                                    <button
                                                        onClick={() => handleCompleteAppointment(appt.id)}
                                                        className="mt-2 ml-2 px-3 py-1 rounded bg-green-600 hover:bg-green-700 text-white"
                                                        title="Mark this appointment as completed"
                                                    >
                                                        Complete
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </>
            )}
        </div>
    );
};

export default BusinessDashboard;
