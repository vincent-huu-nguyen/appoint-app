// src/pages/BusinessPastAppointments.tsx
import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db, auth } from "../firebase";
import { useNavigate } from "react-router-dom";

/* ---------------- Helpers copied from dashboard ---------------- */
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

const formatPhone = (phone?: string) => {
  if (!phone) return "N/A";
  const digits = phone.replace(/\D/g, "");
  const match = digits.match(/^(\d{3})(\d{3})(\d{4})$/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : phone;
};
/* --------------------------------------------------------------- */

type RawAppt = {
  id: string;
  date: string;        // "YYYY-MM-DD"
  time: string;        // "h:mm AM/PM" or "HH:mm"
  service: string;
  duration?: number;
  note?: string | null;

  businessId: string;
  businessName?: string;
  businessPhone?: string;

  customerId?: string | null;
  customerEmail?: string | null;

  // guest fields
  guestName?: string | null;
  guestPhone?: string | null;
  guestEmail?: string | null;
};

type DisplayAppt = RawAppt & {
  displayName: string;
  displayPhone: string;
};

const BusinessPastAppointments = () => {
  const navigate = useNavigate();
  const user = auth.currentUser;

  const [loading, setLoading] = useState(true);
  const [allPast, setAllPast] = useState<DisplayAppt[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!user) return;

      // Get all appts for this business (you could add a date filter if you store a sortable timestamp)
      const qy = query(collection(db, "appointments"), where("businessId", "==", user.uid));
      const snap = await getDocs(qy);

      const rows: RawAppt[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        rows.push({
          id: d.id,
          date: data.date,
          time: data.time,
          service: data.service,
          duration: data.duration,
          note: data.note ?? null,
          businessId: data.businessId,
          businessName: data.businessName,
          businessPhone: data.businessPhone,
          customerId: data.customerId ?? null,
          customerEmail: data.customerEmail ?? null,
          guestName: data.guestName ?? null,
          guestPhone: data.guestPhone ?? null,
          guestEmail: data.guestEmail ?? null,
        });
      });

      const nowTs = Date.now();
      const pastOnly = rows.filter((r) => apptTimestamp({ date: r.date, time: r.time }) < nowTs);

      // Enrich with customer profile (if any), otherwise guest fields
      const withNames: DisplayAppt[] = await Promise.all(
        pastOnly.map(async (r) => {
          if (r.customerId) {
            try {
              const uSnap = await getDoc(doc(db, "users", r.customerId));
              if (uSnap.exists()) {
                const u = uSnap.data() as any;
                return {
                  ...r,
                  displayName: u.name || "Customer",
                  displayPhone: formatPhone(u.phone),
                };
              }
            } catch {
              // ignore and fallback to email or "Customer"
            }
            return {
              ...r,
              displayName: r.customerEmail || "Customer",
              displayPhone: "N/A",
            };
          }
          // guest
          return {
            ...r,
            displayName: r.guestName || "Guest",
            displayPhone: formatPhone(r.guestPhone || undefined),
          };
        })
      );

      // sort newest first
      withNames.sort(
        (a, b) => apptTimestamp({ date: b.date, time: b.time }) - apptTimestamp({ date: a.date, time: a.time })
      );

      setAllPast(withNames);
      setLoading(false);
    };

    load();
  }, [user]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allPast;
    return allPast.filter((a) => {
      const hay = [
        a.displayName,
        a.displayPhone,
        a.service,
        a.note || "",
        a.date,
        a.time,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [allPast, search]);

  if (!user) {
    return <p className="text-center mt-10 text-red-600">Please sign in.</p>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-semibold">Past Appointments</h1>
        <button
          onClick={() => navigate(-1)}
          className="bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded"
        >
          ← Back
        </button>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search past appointments (name, phone, service, note)…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full border p-2 rounded mb-6"
      />

      {loading ? (
        <p className="text-gray-600">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-600">No past appointments found.</p>
      ) : (
        <ul className="space-y-4">
          {filtered.map((appt) => (
            <li key={appt.id} className="border p-4 rounded shadow bg-white">
              <p className="font-semibold">Customer: {appt.displayName}</p>
              <p>Phone: {formatPhone(appt.displayPhone)}</p>
              <p>
                Date:{" "}
                {new Date(appt.date + "T00:00:00").toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                })}
              </p>
              <p>Time: {appt.time}</p>
              <p>Service: {appt.service}</p>
              {typeof appt.note === "string" && appt.note.trim() !== "" && (
                <p className="mt-2 text-gray-700">
                  <span className="font-semibold">Note:</span>{" "}
                  <span className="whitespace-pre-wrap">{appt.note}</span>
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default BusinessPastAppointments;
