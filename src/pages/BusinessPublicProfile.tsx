import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { v4 as uuidv4 } from "uuid";
import profilePlaceholder from "../assets/profilePlaceholder.png";

const BusinessPublicProfile = () => {
  const { id } = useParams();
  const [business, setBusiness] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const navigate = useNavigate();
  const user = auth.currentUser;

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

  const handleBook = async () => {
    if (!user || !date || !time || !business) {
      alert("Please complete all fields.");
      return;
    }

    const appointmentId = uuidv4();
    await setDoc(doc(db, "appointments", appointmentId), {
      customerId: user.uid,
      businessId: id,
      businessName: business.businessName,
      businessPhone: business.phone,
      date,
      time,
    });

    alert("Appointment booked!");
    navigate("/appointments");
  };

  if (loading) return <p className="text-center mt-10">Loading...</p>;
  if (!business) return <p className="text-center mt-10 text-red-600">Business not found.</p>;

  return (
    <div className="flex justify-center mt-10">
      <div className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-md text-center border">
        <img
          src={business.profilePicture || profilePlaceholder}
          alt="Profile"
          className="w-32 h-32 object-cover rounded-full mx-auto mb-4 bg-gray-200"
        />
        <h2 className="text-2xl font-bold text-gray-800 mb-1">{business.businessName}</h2>
        <p className="text-gray-600 mb-1"><span className="font-semibold">Owner:</span> {business.name}</p>
        <p className="text-gray-600 mb-4"><span className="font-semibold">Phone:</span> {business.phone}</p>

        <div className="border-t pt-4 mt-4">
          <h3 className="text-lg font-semibold mb-3 text-gray-700">Book an Appointment</h3>
          <div className="flex gap-3 justify-center mb-4">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border p-2 rounded w-1/2"
            />
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="border p-2 rounded w-1/2"
            />
          </div>
          <button
            onClick={handleBook}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
          >
            Book Appointment
          </button>
        </div>
      </div>
    </div>
  );
};

export default BusinessPublicProfile;
