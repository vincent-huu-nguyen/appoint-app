// src/pages/BusinessCreateAppointment.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { v4 as uuidv4 } from "uuid";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  Availability,
  DayIndex,
  formatDateLocal,
  parseHHMM,
  roundUpTo,
} from "../utils/availability";

/* ----------------------------- Types ----------------------------- */

type Service = {
  name: string;
  price: number;
  duration: number;
  pricePlus?: boolean;
};

type Appointment = {
  id?: string;
  customerId?: string | null;
  customerEmail?: string | null;

  // guest fields if no account
  guestName?: string | null;
  guestPhone?: string | null;
  guestEmail?: string | null;

  businessId: string;
  businessName: string;
  businessPhone?: string;

  service: string;
  duration: number;
  date: string; // YYYY-MM-DD
  time: string; // e.g. "10:30 AM"
  note?: string | null;
};

type Customer = {
  uid: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: "customer" | "admin";
};

type CustomerMode = "existing" | "guest";

/* ----------------------------- Helpers --------------------------- */

const isSameLocalDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const displayPrice = (s?: Service) =>
  s ? `$${Number(s.price ?? 0).toFixed(2)}${s.pricePlus ? "+" : ""}` : "$0.00";

/* ----------------------------- Component ------------------------- */

const BusinessCreateAppointment = () => {
  const navigate = useNavigate();
  const { apptId } = useParams<{ apptId: string }>();

  const user = auth.currentUser; // business user

  // business profile
  const [business, setBusiness] = useState<any>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [availability, setAvailability] = useState<Availability | null>(null);

  // booking form
  const [selectedService, setSelectedService] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>(""); // "10:30 AM"
  const [note, setNote] = useState("");

  // customer selection
  const [mode, setMode] = useState<CustomerMode>("existing");
  const [lockedMode, setLockedMode] = useState<CustomerMode | null>(null); // lock when editing

  // existing customer lookup
  const [customerEmail, setCustomerEmail] = useState("");
  const [foundCustomer, setFoundCustomer] = useState<Customer | null>(null);
  const [customerSearchError, setCustomerSearchError] = useState("");

  // guest fields
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");

  // booked times (for selected date)
  const [bookedTimes, setBookedTimes] = useState<{ time: string; duration: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [error, setError] = useState("");

  /* --------------------------- Load business --------------------------- */

  useEffect(() => {
    const loadBusiness = async () => {
      if (!user) return;
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        const data = snap.data();
        setBusiness(data);
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
            : null
        );
      }
    };
    loadBusiness();
  }, [user]);

  /* ---------------------- Load existing appointment --------------------- */

  useEffect(() => {
    const loadAppt = async () => {
      if (!apptId) {
        setLoading(false);
        return;
      }
      if (!user) return;

      const snap = await getDoc(doc(db, "appointments", apptId));
      if (!snap.exists()) {
        setLoading(false);
        return;
      }

      const appt = snap.data() as Appointment;
      setIsEdit(true);

      // service/date/time/note
      setSelectedService(appt.service);
      setSelectedDate(new Date(appt.date + "T12:00:00")); // noon to avoid TZ shifts
      setSelectedTime(appt.time);
      setNote(appt.note || "");

      // lock & hydrate mode-specific fields
      if (appt.customerId) {
        setLockedMode("existing");
        setMode("existing");
        // Fetch customer to show read-only summary
        const uSnap = await getDoc(doc(db, "users", appt.customerId));
        if (uSnap.exists()) {
          const u = uSnap.data() as any;
          setFoundCustomer({
            uid: appt.customerId,
            name: u.name,
            email: u.email,
            phone: u.phone,
            role: u.role,
          });
          setCustomerEmail(u.email || "");
        } else {
          // still show the email if stored
          setCustomerEmail(appt.customerEmail || "");
        }
      } else {
        setLockedMode("guest");
        setMode("guest");
        setGuestName(appt.guestName || "");
        setGuestPhone(appt.guestPhone || "");
        setGuestEmail(appt.guestEmail || "");
      }

      setLoading(false);
    };
    loadAppt();
  }, [apptId, user]);

  /* ------------------------ Load booked times per date ------------------- */
  useEffect(() => {
    const fetchBookedTimes = async () => {
      if (!selectedDate || !user) return;
      const dateStr = formatDateLocal(selectedDate);
      const qy = query(
        collection(db, "appointments"),
        where("businessId", "==", user.uid),
        where("date", "==", dateStr)
      );
      const snapshot = await getDocs(qy);
      const rows: { time: string; duration: number }[] = [];
      snapshot.forEach((docSnap) => {
        const ap = docSnap.data() as any;
        // If editing the same appt, exclude it from the conflict list so user can keep its time
        if (isEdit && docSnap.id === apptId) return;
        rows.push({ time: ap.time, duration: ap.duration || 30 });
      });
      setBookedTimes(rows);
    };
    fetchBookedTimes();
  }, [selectedDate, user, isEdit, apptId]);

  /* --------------------------- Slot generation -------------------------- */

  const slots = useMemo(() => {
    if (!selectedService || !selectedDate) return [];
    const service = services.find((s) => s.name === selectedService);
    if (!service) return [];

    // blackout date?
    const dateStr = formatDateLocal(selectedDate);
    if (availability?.blackoutDates?.includes(dateStr)) return [];

    // windows: use configured weekly or fallback 8–18
    const dayIdx = selectedDate.getDay() as DayIndex;
    const windows =
      availability?.weekly?.[dayIdx] ?? [{ start: "08:00", end: "18:00" }];

    const out: string[] = [];
    const now = new Date();

    const buildForWindow = (startHHMM: string, endHHMM: string) => {
      const startMin = parseHHMM(startHHMM);
      const endMin = parseHHMM(endHHMM);

      const windowStart = new Date(selectedDate);
      windowStart.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0);

      const windowEnd = new Date(selectedDate);
      windowEnd.setHours(Math.floor(endMin / 60), endMin % 60, 0, 0);

      let cursor = new Date(windowStart);
      if (isSameLocalDay(selectedDate, now)) {
        const minStart = roundUpTo(now, 15);
        if (minStart > cursor) cursor = minStart;
      }

      while (cursor < windowEnd) {
        const slotStart = new Date(cursor);
        const slotEnd = new Date(cursor);
        slotEnd.setMinutes(slotEnd.getMinutes() + service.duration);

        if (slotEnd > windowEnd) break;

        const overlaps = bookedTimes.some((booked) => {
          const [hour, min, meridian] = booked.time.split(/[:\s]/);
          const bookedStart = new Date(selectedDate);
          bookedStart.setHours(
            meridian?.toUpperCase() === "PM" && hour !== "12"
              ? parseInt(hour) + 12
              : parseInt(hour),
            parseInt(min)
          );
          const bookedEnd = new Date(bookedStart);
          bookedEnd.setMinutes(bookedEnd.getMinutes() + (booked.duration || 30));

          return (
            (slotStart >= bookedStart && slotStart < bookedEnd) ||
            (slotEnd > bookedStart && slotEnd <= bookedEnd) ||
            (slotStart <= bookedStart && slotEnd >= bookedEnd)
          );
        });

        if (!overlaps) {
          out.push(
            slotStart.toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            })
          );
        }

        cursor.setMinutes(cursor.getMinutes() + 15);
      }
    };

    windows.forEach((w) => w.start && w.end && buildForWindow(w.start, w.end));
    return out;
  }, [selectedService, selectedDate, services, availability, bookedTimes]);

  /* ------------------------- Existing customer search -------------------- */

  const findCustomer = async () => {
    setCustomerSearchError("");
    setFoundCustomer(null);
    const email = customerEmail.trim().toLowerCase();
    if (!email) {
      setCustomerSearchError("Enter an email to find a customer.");
      return;
    }
    const qy = query(
      collection(db, "users"),
      where("email", "==", email),
      where("role", "==", "customer")
    );
    const snap = await getDocs(qy);
    if (snap.empty) {
      setCustomerSearchError("No customer account found with that email.");
      return;
    }
    const d = snap.docs[0];
    const u = d.data() as any;
    setFoundCustomer({
      uid: d.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
    });
  };

  /* ------------------------------- Save --------------------------------- */

  const handleSave = async () => {
    try {
      setError("");
      if (!user) throw new Error("Not signed in.");
      if (!business) throw new Error("Business profile missing.");
      if (!selectedService) throw new Error("Please select a service.");
      if (!selectedDate) throw new Error("Please pick a date.");
      if (!selectedTime) throw new Error("Please choose a time.");

      const svc = services.find((s) => s.name === selectedService);
      if (!svc) throw new Error("Invalid service.");

      // Build payload, respect locked mode when editing
      let payload: Appointment = {
        businessId: user.uid,
        businessName: business.businessName,
        businessPhone: business.phone,
        service: selectedService,
        duration: svc.duration,
        date: formatDateLocal(selectedDate),
        time: selectedTime,
        note: note.trim() || null,
      };

      if ((isEdit && lockedMode === "existing") || (!isEdit && mode === "existing")) {
        if (!foundCustomer) {
          throw new Error("Select an existing customer first.");
        }
        payload.customerId = foundCustomer.uid;
        payload.customerEmail = (foundCustomer.email || "").toLowerCase();
        payload.guestName = null;
        payload.guestPhone = null;
        payload.guestEmail = null;
      } else {
        // guest
        if (!guestName.trim() || !guestPhone.trim()) {
          throw new Error("Guest name and phone are required.");
        }
        payload.customerId = null;
        payload.customerEmail = null;
        payload.guestName = guestName.trim();
        payload.guestPhone = guestPhone.trim();
        payload.guestEmail = guestEmail.trim() || null;
      }

      setSaving(true);

      if (isEdit && apptId) {
        await setDoc(doc(db, "appointments", apptId), payload, { merge: true });
        alert("Appointment updated.");
      } else {
        const newId = uuidv4();
        await setDoc(doc(db, "appointments", newId), payload);
        alert("Appointment created.");
      }

      navigate("/dashboard"); // back to dashboard list
    } catch (e: any) {
      setError(e?.message || "Failed to save appointment.");
    } finally {
      setSaving(false);
    }
  };

  /* ----------------------------- Render --------------------------------- */


  return (
    <div className="flex justify-center mt-10 mb-10">
      <div className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-md text-center border">
        <button
          onClick={() => navigate(-1)}
          className="flex text-xs px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition"
        >
          ← Back
        </button>

        <h2 className="text-2xl font-bold text-gray-800 mt-2 mb-4">
          {isEdit ? "Edit Appointment" : "Create Appointment"}
        </h2>

        {/* MODE SWITCH (locked while editing) */}
        <div className="flex items-center justify-center gap-4 mb-4">
          <label
            className={`inline-flex items-center gap-2 ${
              isEdit ? "opacity-60 cursor-not-allowed" : ""
            }`}
          >
            <input
              type="radio"
              name="cust-mode"
              value="existing"
              checked={mode === "existing"}
              onChange={() => {
                if (!isEdit) setMode("existing");
              }}
              disabled={isEdit}
            />
            <span className="text-sm">Existing customer</span>
          </label>
          <label
            className={`inline-flex items-center gap-2 ${
              isEdit ? "opacity-60 cursor-not-allowed" : ""
            }`}
          >
            <input
              type="radio"
              name="cust-mode"
              value="guest"
              checked={mode === "guest"}
              onChange={() => {
                if (!isEdit) setMode("guest");
              }}
              disabled={isEdit}
            />
            <span className="text-sm">Guest (no account)</span>
          </label>
        </div>

        {/* EXISTING CUSTOMER */}
        {mode === "existing" && (
          <div className="text-left mb-6">
            {isEdit ? (
              <div className="rounded border bg-gray-50 p-3 text-sm">
                <p className="mb-1">
                  <span className="font-semibold">Customer:</span>{" "}
                  {foundCustomer?.name || "Customer"}
                </p>
                {foundCustomer?.email && <p className="mb-1">{foundCustomer.email}</p>}
                {foundCustomer?.phone && <p>{foundCustomer.phone}</p>}
                <p className="mt-2 text-xs text-gray-500">
                  Customer cannot be changed while editing this appointment.
                </p>
              </div>
            ) : (
              <>
                <label className="block text-sm font-medium mb-1">Customer Email</label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => {
                      setCustomerEmail(e.target.value);
                      setCustomerSearchError("");
                      setFoundCustomer(null);
                    }}
                    placeholder="customer@example.com"
                    className="border p-2 rounded w-full"
                  />
                  <button
                    onClick={findCustomer}
                    type="button"
                    className="bg-gray-800 text-white px-3 rounded hover:bg-gray-900"
                  >
                    Find
                  </button>
                </div>
                {customerSearchError && (
                  <p className="text-sm text-red-600 mt-1">{customerSearchError}</p>
                )}
                {foundCustomer && (
                  <div className="mt-2 text-sm text-gray-700">
                    <p>
                      <span className="font-semibold">Selected:</span>{" "}
                      {foundCustomer.name || "Customer"}
                    </p>
                    <p>{foundCustomer.email}</p>
                    {foundCustomer.phone && <p>{foundCustomer.phone}</p>}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* GUEST */}
        {mode === "guest" && (
          <div className="text-left mb-6 space-y-3">
            {isEdit && (
              <p className="text-xs text-gray-500">
                Guest contact can be updated. This appointment will remain a guest booking.
              </p>
            )}
            <div>
              <label className="block text-sm font-medium mb-1">Guest Name</label>
              <input
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Full name"
                className="border p-2 rounded w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Guest Phone</label>
              <input
                type="tel"
                value={guestPhone}
                onChange={(e) => setGuestPhone(formatPhoneLive(e.target.value))}
                placeholder="555-123-4567"
                className="border p-2 rounded w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Guest Email (optional)</label>
              <input
                type="email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                placeholder="guest@example.com"
                className="border p-2 rounded w-full"
              />
            </div>
          </div>
        )}

        {/* Service */}
        <div className="text-left mb-4">
          <label className="block text-sm font-medium mb-1">Service</label>
          <select
            value={selectedService}
            onChange={(e) => {
              setSelectedService(e.target.value);
              setSelectedTime(""); // reset time on service change
            }}
            className="border p-2 rounded w-full"
          >
            <option value="">Select a service</option>
            {services.map((s, i) => (
              <option key={i} value={s.name}>
                {s.name} — {displayPrice(s)}, {s.duration} min
              </option>
            ))}
          </select>
        </div>

        {/* Datepicker */}
        <DatePicker
          selected={selectedDate}
          onChange={(date) => {
            setSelectedDate(date);
            setSelectedTime("");
          }}
          minDate={new Date()}
          inline
          calendarClassName="rounded-lg shadow"
          filterDate={(d) => {
            // disable blackout days if availability exists
            if (!availability) return true;
            const ds = formatDateLocal(d as Date);
            return !availability.blackoutDates?.includes(ds);
          }}
        />

        {/* Time slots */}
        {selectedDate && (
          <div className="mt-4">
            <div className="flex overflow-x-auto gap-2 px-1 pb-1">
              {slots.map((time) => (
                <button
                  key={time}
                  onClick={() => setSelectedTime(time)}
                  className={`min-w-[100px] px-3 py-1 border rounded-full text-sm whitespace-nowrap ${
                    selectedTime === time
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-800 hover:bg-blue-100"
                  }`}
                >
                  {time}
                </button>
              ))}
            </div>
            {slots.length === 0 && (
              <p className="mt-3 text-sm text-gray-500">
                {selectedService ? "No times available for this date." : "Please select a service first."}
              </p>
            )}
          </div>
        )}

        {/* Note */}
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note to self (optional)"
          className="border p-2 rounded w-full mt-4 resize-none"
          rows={3}
        />

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving}
          className={`mt-6 px-4 py-3 rounded text-white w-full transition ${
            saving ? "bg-indigo-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700"
          }`}
        >
          {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Appointment"}
        </button>

        {error && (
          <p className="mt-2 text-sm text-red-600" role="alert" aria-live="polite">
            {error}
          </p>
        )}
      </div>
    </div>
  );
};

export default BusinessCreateAppointment;

/* --------------------------- Little helpers --------------------------- */

// simple live formatter like 555-123-4567
function formatPhoneLive(value: string) {
  const numbers = value.replace(/\D/g, "");
  const match = numbers.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);
  if (!match) return value;
  const [, a, b, c] = match;
  if (a && !b && !c) return a;
  if (a && b && !c) return `${a}-${b}`;
  if (a && b && c) return `${a}-${b}-${c}`;
  return value;
}
