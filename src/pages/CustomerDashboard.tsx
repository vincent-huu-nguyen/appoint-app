// src/pages/CustomerDashboard.tsx
import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { db, auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import profilePlaceholder from "../assets/profilePlaceholder.png";

type Visibility = "public" | "search" | "private";

type Biz = {
  id: string;
  role?: string;
  businessName?: string;
  name?: string;
  phone?: string;
  visibility?: Visibility; // may be missing on older docs
  profilePicture?: string; // HTTPS URL
  // Back-compat keys
  profilePhotoUrl?: string;
  photoURL?: string;
  profileImageUrl?: string;
  avatarUrl?: string;
  profilePicUrl?: string;
  profilePictureUrl?: string;
  [k: string]: any;
};

const toLocalDate = (yyyymmdd: string) => {
  const [y, m, d] = yyyymmdd.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const parseMinutes = (t: string) => {
  const m12 = t?.match?.(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (m12) {
    let h = parseInt(m12[1], 10);
    const m = parseInt(m12[2], 10);
    const ampm = m12[3].toUpperCase();
    if (ampm === "PM" && h !== 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    return h * 60 + m;
  }
  const m24 = t?.match?.(/^(\d{1,2}):(\d{2})$/);
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

const getBizAvatarUrl = (biz: Biz) =>
  biz.profilePicture ||
  biz.profilePhotoUrl ||
  biz.photoURL ||
  biz.profileImageUrl ||
  biz.avatarUrl ||
  biz.profilePicUrl ||
  biz.profilePictureUrl ||
  profilePlaceholder;

const normalizeVis = (v?: Visibility): Visibility =>
  (v as Visibility) || "search"; // treat missing as "search" for older docs

const CustomerDashboard = () => {
  const [search, setSearch] = useState("");
  const [allAdmins, setAllAdmins] = useState<Biz[]>([]);          // role == "admin" (single query)
  const [loadedAdmins, setLoadedAdmins] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [viewingAppointments, setViewingAppointments] = useState(false);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [showPast, setShowPast] = useState(false);
  const navigate = useNavigate();

  const user = auth.currentUser;

  const handleLogout = async () => {
    await signOut(auth);
    setTimeout(() => navigate("/"), 50);
  };

  // Fetch ALL admin businesses once. Filter by visibility in memory.
  useEffect(() => {
    const fetchAdmins = async () => {
      try {
        setErr(null);
        const qy = query(collection(db, "users"), where("role", "==", "admin"));
        const snap = await getDocs(qy);
        const data: Biz[] = snap.docs.map((d) => ({ ...(d.data() as Biz), id: d.id }));
        // Optional: sort for determinism
        data.sort((a, b) => (a.businessName || "").localeCompare(b.businessName || ""));
        setAllAdmins(data);
      } catch (e: any) {
        console.error("Failed to load businesses", e);
        setErr("We couldn't load businesses right now.");
      } finally {
        setLoadedAdmins(true);
      }
    };
    fetchAdmins();
  }, []);

  // Derived lists
  const publicOnly = useMemo(
    () => allAdmins.filter((b) => normalizeVis(b.visibility) === "public"),
    [allAdmins]
  );

  const searchable = useMemo(
    () =>
      allAdmins.filter((b) => {
        const vis = normalizeVis(b.visibility);
        return vis === "public" || vis === "search";
      }),
    [allAdmins]
  );

  // Search results (name or owner)
  const filteredSearchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return searchable
      .filter(
        (biz) =>
          (biz.businessName || "").toLowerCase().includes(q) ||
          (biz.name || "").toLowerCase().includes(q)
      )
      .sort((a, b) => (a.businessName || "").localeCompare(b.businessName || ""));
  }, [search, searchable]);

  // Fetch user's appointments
  const fetchAppointments = async () => {
    if (!user) return;
    const qy = query(collection(db, "appointments"), where("customerId", "==", user.uid));
    const snapshot = await getDocs(qy);
    const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as any[];
    data.sort((a, b) => apptTimestamp(a) - apptTimestamp(b));
    setAppointments(data);
  };

  // --- upcoming vs past ---
  const nowTs = Date.now();
  const upcoming = appointments
    .filter((a) => apptTimestamp(a) >= nowTs && a.active !== false)
    .sort((a, b) => apptTimestamp(a) - apptTimestamp(b));
  const past = appointments
    .filter((a) => apptTimestamp(a) < nowTs || a.active === false || a.status === "completed")
    .sort((a, b) => apptTimestamp(b) - apptTimestamp(a));
  const list = showPast ? past : upcoming;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Customer Dashboard</h1>
        <div className="flex">
          {!viewingAppointments && (
            <button
              onClick={async () => {
                await fetchAppointments();
                setViewingAppointments(true);
                setShowPast(false);
              }}
              className="bg-indigo-800 hover:bg-indigo-900 text-white px-4 py-2 rounded"
            >
              View My Appointments
            </button>
          )}
          {viewingAppointments && (
            <button
              onClick={() => setViewingAppointments(false)}
              className="bg-indigo-800 hover:bg-indigo-900 text-white px-4 py-2 rounded"
            >
              Book an Appointment
            </button>
          )}
          <button
            onClick={handleLogout}
            className="bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 ml-2 rounded"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Error banner (shows if Firestore query fails) */}
      {err && (
        <div className="mb-4 p-3 rounded bg-red-50 text-red-700 text-sm">
          {err} Try again in a moment.
        </div>
      )}

      {viewingAppointments ? (
        <>
          {/* Toggle: Upcoming / Past */}
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => setShowPast(false)}
              className={`px-4 py-2 rounded ${
                !showPast ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-800"
              }`}
            >
              Upcoming
            </button>
            <button
              onClick={() => setShowPast(true)}
              className={`px-4 py-2 rounded ${
                showPast ? "bg-gray-800 text-white" : "bg-gray-200 text-gray-800"
              }`}
            >
              Past
            </button>
          </div>

          {list.length === 0 ? (
            <p className="text-gray-600">
              {showPast ? "No past appointments." : "No appointments scheduled."}
            </p>
          ) : (
            <ul className="space-y-4">
              {list.map((appt) => (
                <li key={appt.id} className="border p-4 rounded shadow">
                  <p className="font-bold">{appt.businessName}</p>
                  <p className="font-semibold">Phone Number: {appt.businessPhone}</p>
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
                  {appt.service && (
                    <p>
                      Service: {appt.service}
                      {appt.duration ? ` • ${appt.duration} min` : ""}
                    </p>
                  )}
                  {showPast ? (
                    <p className="text-xs text-gray-500 mt-2">
                      {appt.status === "completed" ? "Completed" : "Past"}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-500 pt-4">
                      To reschedule or cancel an appointment, please contact the business.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          {/* Booking UI */}
          <input
            type="text"
            placeholder="Search for a business..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border p-2 rounded mb-4"
          />

          {/* Loading state for first admin fetch */}
          {!loadedAdmins ? (
            <p className="text-sm text-gray-500">Loading businesses…</p>
          ) : search.trim().length === 0 ? (
            // Featured PUBLIC businesses
            <>
              {publicOnly.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No featured businesses yet. Start typing to search.
                </p>
              ) : (
                <>
                  <h2 className="text-lg font-semibold mb-2">Featured Businesses</h2>
                  <ul className="space-y-2 mb-8">
                    {publicOnly.map((biz) => (
                      <li
                        key={biz.id}
                        className="group border p-4 rounded hover:bg-gray-100 cursor-pointer"
                        onClick={() => navigate(`/business/${biz.id}`)}
                      >
                        <div className="flex items-center gap-4">
                          <img
                            src={getBizAvatarUrl(biz)}
                            alt={`${biz.businessName || "Business"} logo`}
                            className="h-12 w-12 rounded-full object-cover bg-gray-100 flex-shrink-0 transition group-hover:scale-105"
                            loading="lazy"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = profilePlaceholder;
                            }}
                          />
                          <div className="min-w-0">
                            <h3 className="font-bold text-lg truncate">
                              {biz.businessName || "Unnamed Business"}
                            </h3>
                            <p className="text-sm text-gray-600 truncate">Owner: {biz.name || "—"}</p>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          ) : // Searching: use the preloaded all-admins list filtered by visibility!=private
          filteredSearchResults.length === 0 ? (
            <p className="text-sm text-gray-500">No matches found.</p>
          ) : (
            <ul className="space-y-2 mb-8">
              {filteredSearchResults.map((biz) => (
                <li
                  key={biz.id}
                  className="group border p-4 rounded hover:bg-gray-100 cursor-pointer"
                  onClick={() => navigate(`/business/${biz.id}`)}
                >
                  <div className="flex items-center gap-4">
                    <img
                      src={getBizAvatarUrl(biz)}
                      alt={`${biz.businessName || "Business"} logo`}
                      className="h-12 w-12 rounded-full object-cover bg-gray-100 flex-shrink-0 transition group-hover:scale-105"
                      loading="lazy"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = profilePlaceholder;
                      }}
                    />
                    <div className="min-w-0">
                      <h3 className="font-bold text-lg truncate">
                        {biz.businessName || "Unnamed Business"}
                      </h3>
                      <p className="text-sm text-gray-600 truncate">Owner: {biz.name || "—"}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
};

export default CustomerDashboard;
