// src/pages/BusinessPublicProfile.tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  setDoc,
  query,
  collection,
  where,
  getDocs,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { v4 as uuidv4 } from "uuid";
import profilePlaceholder from "../assets/profilePlaceholder.png";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  Availability,
  DayIndex,
  formatDateLocal,
  parseHHMM,
  roundUpTo,
} from "../utils/availability";

/* ----------------------------- Helpers ----------------------------- */

const formatPhoneNumber = (phone: string) => {
  const digits = (phone || "").replace(/\D/g, "");
  const m = digits.match(/^(\d{3})(\d{3})(\d{4})$/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : phone || "N/A";
};

const displayPrice = (s: any) =>
  `$${Number(s?.price ?? 0).toFixed(2)}${s?.pricePlus ? "+" : ""}`;

const isSameLocalDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const fontCssFromId = (id?: string) => {
  const MAP: Record<string, string> = {
    "ui-sans":
      'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Liberation Sans", sans-serif',
    "ui-serif": 'Georgia, "Times New Roman", Times, serif',
    "ui-mono": '"Courier New", Courier, monospace',
    "ui-display": 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif',
    "ui-round":
      '"Trebuchet MS", "Lucida Grande", "Lucida Sans Unicode", "Lucida Sans", Arial, sans-serif',
    "gf-lobster": '"Lobster", cursive',
    "gf-poppins": '"Poppins", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
  };
  return MAP[id || "ui-sans"] || MAP["ui-sans"];
};

/* ----------------------------- Component ----------------------------- */

const BusinessPublicProfile = () => {
  const { id } = useParams();
  const [business, setBusiness] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>("");

  const [selectedService, setSelectedService] = useState("");
  const [bookedTimes, setBookedTimes] = useState<
    { time: string; duration: number }[]
  >([]);

  const [error, setError] = useState<string>("");
  const [note, setNote] = useState("");

  const navigate = useNavigate();
  const user = auth.currentUser;

  /* ----------------------------- Load business ----------------------------- */

  useEffect(() => {
    const fetchBusiness = async () => {
      if (!id) return;
      const ref = doc(db, "users", id);
      const snap = await getDoc(ref);
      if (snap.exists()) setBusiness(snap.data());
      setLoading(false);
    };
    fetchBusiness();
  }, [id]);

  /* ----------------------------- Load bookings (selected day) ----------------------------- */

  useEffect(() => {
    const fetchBookedTimes = async () => {
      if (!selectedDate || !id) return;
      const dateStr = formatDateLocal(selectedDate);
      const qy = query(
        collection(db, "appointments"),
        where("businessId", "==", id),
        where("date", "==", dateStr)
      );
      const snapshot = await getDocs(qy);
      const times: { time: string; duration: number }[] = [];
      snapshot.forEach((docSnap) => {
        const appt = docSnap.data();
        times.push({ time: appt.time, duration: appt.duration || 30 });
      });
      setBookedTimes(times);
    };
    fetchBookedTimes();
  }, [selectedDate, id]);

  useEffect(() => {
    setError("");
  }, [selectedService, selectedDate, selectedTime]);

  /* ----------------------------- Booking ----------------------------- */

  const handleBook = async () => {
    if (!user || !selectedDate || !selectedTime || !business || !selectedService) {
      setError("Please select a service, date, and time before booking.");
      return;
    }

    const service = business.services.find((s: any) => s.name === selectedService);
    if (!service) {
      setError("Please choose a valid service.");
      return;
    }

    setError("");

    const appointmentId = uuidv4();
    await setDoc(doc(db, "appointments", appointmentId), {
      customerId: user.uid,
      businessId: id,
      businessName: business.businessName,
      businessPhone: business.phone,
      service: selectedService,
      duration: service.duration,
      date: formatDateLocal(selectedDate),
      time: selectedTime,
      note: note.trim() || null,
    });

    alert("Appointment booked!");
    navigate("/appointments");
  };

  /* ----------------------------- Timeslot generation (kept logic) ----------------------------- */

  const generateTimeSlots = () => {
    if (!selectedService || !selectedDate) return [];
    if (!business?.services) return [];

    const service = business.services.find((s: any) => s.name === selectedService);
    if (!service) return [];

    const availability: Availability | undefined = business.availability;

    const dateStr = formatDateLocal(selectedDate);
    if (availability?.blackoutDates?.includes(dateStr)) return []; // hard closed

    const dayIdx = selectedDate.getDay() as DayIndex;
    // fallback window if no availability configured
    const windows = availability?.weekly?.[dayIdx] ?? [{ start: "08:00", end: "18:00" }];

    const duration = service.duration;
    const slots: string[] = [];
    const now = new Date();

    const buildSlotsForWindow = (startHHMM: string, endHHMM: string) => {
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
        slotEnd.setMinutes(slotEnd.getMinutes() + duration);

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
          slots.push(
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

    windows.forEach((w: any) => {
      if (w?.start && w?.end) buildSlotsForWindow(w.start, w.end);
    });

    return slots;
  };

  const slots = selectedDate ? generateTimeSlots() : [];

  /* ----------------------------- Render ----------------------------- */

  if (loading) return <p className="text-center mt-10">Loading...</p>;
  if (!business) return <p className="text-center mt-10 text-red-600">Business not found.</p>;

  return (
    <div className="flex justify-center mt-10 mb-10">
      <div className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-md text-center border">
        <button
          onClick={() => navigate(-1)}
          className="flex text-xs px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition"
        >
          ← Back
        </button>

        <img
          src={business.profilePicture || profilePlaceholder}
          alt="Profile"
          className="w-32 h-32 object-cover rounded-full mx-auto mb-4 bg-gray-200"
        />

        {/* Profile info — matched layout to BusinessDashboard */}
        <div className="space-y-2 mt-2 text-center">
          <h2
            className="text-2xl font-bold text-gray-800 mb-1"
            style={{ fontFamily: fontCssFromId(business?.businessNameFontId) }}
          >
            {business.businessName}
          </h2>

          <p className="text-gray-600 font-medium">
            <span className="font-medium">Owner:</span> {business.name || "N/A"}
          </p>

          <p className="text-gray-600 font-bold">
            <span className="font-bold">Phone:</span> {formatPhoneNumber(business.phone)}
          </p>

          <p className="text-gray-700 pt-2 whitespace-pre-wrap">
            {business.description || "N/A"}
          </p>

          {business.availabilityNote && (
            <div className="mt-4 text-center border-t border-gray-300 pt-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-1">Special Notes</h4>
              <p className="text-gray-700 whitespace-pre-wrap">{business.availabilityNote}</p>
            </div>
          )}
        </div>

        {/* Services — bordered block like dashboard */}
        {business.services && business.services.length > 0 && (
          <div className="mt-6 text-left border-t border-b border-gray-300 py-8">
            <h3 className="text-gray-700 font-bold text-center mb-2">Services Offered:</h3>

            <div className="grid grid-cols-3 font-semibold text-sm border-b pb-1 mb-2 text-center">
              <span>Service</span>
              <span>Price</span>
              <span>Duration</span>
            </div>

            <ul className="space-y-1">
              {business.services.map((s: any, i: number) => (
                <li
                  key={i}
                  className="grid grid-cols-3 text-gray-700 text-sm border-b py-1 text-center"
                >
                  <span>{s.name}</span>
                  <span>{displayPrice(s)}</span>
                  <span>{s.duration} mins</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Booking form — kept EXACTLY the same structure/logic */}
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-3 text-gray-700 text-center">
            Book an Appointment
          </h3>

          <select
            value={selectedService}
            onChange={(e) => setSelectedService(e.target.value)}
            className="border p-2 rounded w-full mb-4"
          >
            <option value="">Select a service</option>
            {business.services?.map((s: any, i: number) => (
              <option key={i} value={s.name}>
                {s.name} — {displayPrice(s)}, {s.duration} min
              </option>
            ))}
          </select>

          <DatePicker
            selected={selectedDate}
            onChange={(date) => {
              setSelectedDate(date);
              setSelectedTime("");
            }}
            minDate={new Date()}
            inline
            calendarClassName="rounded-lg shadow"
          />

          {selectedDate && (
            <div className="mt-4">
              <div className="flex overflow-x-auto gap-2 px-1 pb-1">
                {slots.map((time) => (
                  <button
                    key={time}
                    onClick={() => setSelectedTime(time)}
                    className={`min-w-[100px] px-3 py-1 border rounded-full text-sm whitespace-nowrap ${selectedTime === time
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
                  {selectedService
                    ? "No times available for this date."
                    : "Please select a service first."}
                </p>
              )}
            </div>
          )}

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note for the business (optional)"
            className="border p-2 rounded w-full mt-4 resize-none"
            rows={3}
          />

          <button
            onClick={handleBook}
            className="bg-indigo-600 text-white mt-6 px-4 py-2 rounded hover:bg-indigo-700 transition w-full"
          >
            Book Appointment
          </button>

          {error && (
            <p className="mt-2 text-sm text-red-600" role="alert" aria-live="polite">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default BusinessPublicProfile;
