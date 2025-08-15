import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { db, auth } from "../firebase";
import { useNavigate } from "react-router-dom";

const CustomerDashboard = () => {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [viewingAppointments, setViewingAppointments] = useState(false);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [showPast, setShowPast] = useState(false); // toggle for past vs upcoming
  const [hasLoadedBusinesses, setHasLoadedBusinesses] = useState(false); // NEW: lazy fetch on first type
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    setTimeout(() => {
      navigate("/");
    }, 50);
  };

  // ---- helpers ----
  const toLocalDate = (yyyymmdd: string) => {
    const [y, m, d] = yyyymmdd.split("-").map(Number);
    return new Date(y, m - 1, d); // local midnight
  };

  const parseMinutes = (t: string) => {
    // supports "h:mm AM/PM" or "HH:mm"
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

  const user = auth.currentUser;

  // Fetch all business users
  const fetchBusinesses = async () => {
    const qy = query(collection(db, "users"), where("role", "==", "admin"));
    const snapshot = await getDocs(qy);
    const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    setResults(data);
  };

  // Fetch user's appointments (then sort soon → later)
  const fetchAppointments = async () => {
    if (!user) return;
    const qy = query(collection(db, "appointments"), where("customerId", "==", user.uid));
    const snapshot = await getDocs(qy);
    const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as any[];
    data.sort((a, b) => apptTimestamp(a) - apptTimestamp(b));
    setAppointments(data);
  };

  // NEW: Only load businesses once the user starts typing (and only once)
  useEffect(() => {
    if (!viewingAppointments && search.trim().length > 0 && !hasLoadedBusinesses) {
      (async () => {
        await fetchBusinesses();
        setHasLoadedBusinesses(true);
      })();
    }
  }, [search, viewingAppointments, hasLoadedBusinesses]);

  const filtered = results.filter((biz) =>
    (biz.businessName || "").toLowerCase().includes(search.toLowerCase())
  );

  // --- derive upcoming vs past ---
  const nowTs = Date.now();
  const upcoming = appointments
    .filter((a) => apptTimestamp(a) >= nowTs && a.active !== false) // active true or undefined
    .sort((a, b) => apptTimestamp(a) - apptTimestamp(b));

  const past = appointments
    .filter((a) => apptTimestamp(a) < nowTs || a.active === false || a.status === "completed")
    .sort((a, b) => apptTimestamp(b) - apptTimestamp(a)); // most recent first

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

          {search.trim().length === 0 ? (
            <p className="text-sm text-gray-500">Start typing to search for businesses…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-500">No matches found.</p>
          ) : (
            <ul className="space-y-2 mb-8">
              {filtered.map((biz) => (
                <li
                  key={biz.id}
                  className="border p-4 rounded hover:bg-gray-100 cursor-pointer"
                  onClick={() => navigate(`/business/${biz.id}`)}
                >
                  <h3 className="font-bold text-lg">{biz.businessName}</h3>
                  <p className="text-sm text-gray-600">Owner: {biz.name}</p>
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
