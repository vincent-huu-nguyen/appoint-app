import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, setDoc, query, collection, where, getDocs, } from "firebase/firestore";
import { db, auth } from "../firebase";
import { v4 as uuidv4 } from "uuid";
import profilePlaceholder from "../assets/profilePlaceholder.png";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const BusinessPublicProfile = () => {
  const { id } = useParams();
  const [business, setBusiness] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>("");
  const navigate = useNavigate();
  const user = auth.currentUser;
  const [selectedService, setSelectedService] = useState("");
  const [bookedTimes, setBookedTimes] = useState<{ time: string; duration: number }[]>([]);


  useEffect(() => {
    const fetchBusiness = async () => {
      if (!id) return;
      const ref = doc(db, "users", id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        setBusiness(snap.data());
      }
      setLoading(false);
    };

    fetchBusiness();
  }, [id]);

  useEffect(() => {
    const fetchBookedTimes = async () => {
      if (!selectedDate || !id) return;

      const dateStr = selectedDate.toISOString().split("T")[0];
      const q = query(
        collection(db, "appointments"),
        where("businessId", "==", id),
        where("date", "==", dateStr)
      );
      const snapshot = await getDocs(q);
      const times: { time: string; duration: number }[] = [];
      snapshot.forEach((docSnap) => {
        const appt = docSnap.data();
        times.push({ time: appt.time, duration: appt.duration || 30 }); // fallback if missing
      });
      setBookedTimes(times);

    };

    fetchBookedTimes();
  }, [selectedDate, id]);

  const handleBook = async () => {
    if (!user || !selectedDate || !selectedTime || !business || !selectedService) {
      alert("Please complete all fields.");
      return;
    }

    const service = business.services.find((s: any) => s.name === selectedService);
    if (!service) return;

    const appointmentId = uuidv4();
    await setDoc(doc(db, "appointments", appointmentId), {
      customerId: user.uid,
      businessId: id,
      businessName: business.businessName,
      businessPhone: business.phone,
      service: selectedService,
      duration: service.duration,
      date: selectedDate.toISOString().split("T")[0],
      time: selectedTime,
    });

    alert("Appointment booked!");
    navigate("/appointments");
  };


  if (loading) return <p className="text-center mt-10">Loading...</p>;
  if (!business) return <p className="text-center mt-10 text-red-600">Business not found.</p>;

  const generateTimeSlots = () => {
    if (!selectedService) return [];

    const service = business.services.find((s: any) => s.name === selectedService);
    if (!service) return [];

    const duration = service.duration; // in minutes
    const slots: string[] = [];

    const start = new Date();
    start.setHours(8, 0, 0, 0); // 8:00 AM
    const end = new Date();
    end.setHours(18, 0, 0, 0); // 6:00 PM

    while (start <= end) {
      const slotTime = start.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });

      const slotStart = new Date(start);
      const slotEnd = new Date(start);
      slotEnd.setMinutes(slotEnd.getMinutes() + duration);

      const overlaps = bookedTimes.some((booked) => {
        const [hour, min, meridian] = booked.time.split(/[:\s]/);
        const bookedStart = new Date(selectedDate!);
        bookedStart.setHours(
          meridian === "PM" && hour !== "12" ? parseInt(hour) + 12 : parseInt(hour),
          parseInt(min)
        );

        const bookedEnd = new Date(bookedStart);
        bookedEnd.setMinutes(bookedEnd.getMinutes() + booked.duration);

        return (
          (slotStart >= bookedStart && slotStart < bookedEnd) ||
          (slotEnd > bookedStart && slotEnd <= bookedEnd) ||
          (slotStart <= bookedStart && slotEnd >= bookedEnd) // full overlap
        );
      });


      if (!overlaps) {
        slots.push(slotTime);
      }

      start.setMinutes(start.getMinutes() + 15);
    }

    return slots;
  };



  return (
    <div className="flex justify-center mt-10 mb-10">
      <div className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-md text-center border">
        <button
          onClick={() => navigate(-1)}
          className="text-blue-600 hover:underline mb-4 text-sm flex items-center"
        >
          ← Back
        </button>

        <img
          src={business.profilePicture || profilePlaceholder}
          alt="Profile"
          className="w-32 h-32 object-cover rounded-full mx-auto mb-4 bg-gray-200"
        />

        {/* Profile info */}
        <h2 className="text-2xl font-bold text-gray-800 mb-1">{business.businessName}</h2>
        <p className="text-gray-600 mb-1">
          <span className="font-semibold">Owner:</span> {business.name || "N/A"}
        </p>
        <p className="text-gray-600 mb-4">
          <span className="font-semibold">Phone:</span> {business.phone || "N/A"}
        </p>
        <p className="text-gray-600 pt-2">{business.description || "N/A"}</p>

        {/* Services table */}
        {business.services && business.services.length > 0 && (
          <div className="mt-6 text-left">
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
                  <span>${s.price.toFixed(2)}</span>
                  <span>{s.duration} min</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Booking form */}
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-3 text-gray-700 text-center">Book an Appointment</h3>

          <select
            value={selectedService}
            onChange={(e) => setSelectedService(e.target.value)}
            className="border p-2 rounded w-full mb-4"
          >
            <option value="">Select a service</option>
            {business.services?.map((s: any, i: number) => (
              <option key={i} value={s.name}>
                {s.name} — ${s.price.toFixed(2)}, {s.duration} min
              </option>
            ))}
          </select>

          <DatePicker
            selected={selectedDate}
            onChange={(date) => setSelectedDate(date)}
            minDate={new Date()}
            inline
            calendarClassName="rounded-lg shadow"
          />

          {selectedDate && (
            <div className="mt-4">
              <div className="flex overflow-x-auto gap-2 px-1 pb-1">
                {generateTimeSlots().map((time) => (
                  <button
                    key={time}
                    onClick={() => setSelectedTime(time)}
                    className={`min-w-[80px] px-3 py-1 border rounded-full text-sm whitespace-nowrap ${selectedTime === time
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-800 hover:bg-blue-100"
                      }`}
                  >
                    {time}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={handleBook}
            className="bg-blue-600 text-white mt-6 px-4 py-2 rounded hover:bg-blue-700 transition w-full"
          >
            Book Appointment
          </button>
        </div>

      </div>
    </div>
  );
};

export default BusinessPublicProfile;
