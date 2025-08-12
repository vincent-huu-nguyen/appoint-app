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
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    setTimeout(() => {
      navigate("/");
    }, 50); // short delay to avoid race condition
  };

  const toLocalDate = (yyyymmdd: string) => {
    const [y, m, d] = yyyymmdd.split("-").map(Number);
    return new Date(y, m - 1, d); // local midnight
  };


  const user = auth.currentUser;

  // Fetch all business users
  const fetchBusinesses = async () => {
    const q = query(collection(db, "users"), where("role", "==", "admin"));
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    setResults(data);
  };

  // Fetch user's appointments
  const fetchAppointments = async () => {
    if (!user) return;
    const q = query(collection(db, "appointments"), where("customerId", "==", user.uid));
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    setAppointments(data);
  };

  useEffect(() => {
    if (!viewingAppointments) fetchBusinesses();
  }, [viewingAppointments]);

  const filtered = results.filter((biz) =>
    biz.businessName.toLowerCase().includes(search.toLowerCase())
  );

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
              }}
              className="bg-gray-800 text-white px-4 py-2 rounded"
            >
              View My Appointments
            </button>
          )}
          {viewingAppointments && (
            <button
              onClick={() => setViewingAppointments(false)}
              className="bg-blue-600 text-white px-4 py-2 rounded"
            >
              Book an Appointment
            </button>
          )}

          <button
            onClick={handleLogout}
            className="bg-red-600 text-white px-4 py-2 ml-2 rounded hover:bg-red-700"
          >
            Logout
          </button>
        </div>
      </div>

      {viewingAppointments ? (
        <>
          {appointments.length === 0 ? (
            <p className="text-gray-600">No appointments scheduled.</p>
          ) : (
            <ul className="space-y-4">
              {appointments.map((appt) => (
                <li key={appt.id} className="border p-4 rounded shadow">
                  <p className="font-bold">{appt.businessName}</p>
                  <p className="font-semibold">Phone Number: {appt.businessPhone}</p>
                  <p>
                    Date: {toLocalDate(appt.date).toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                    })}

                  </p>
                  <p>Time: {appt.time}</p>
                  <p className="text-sm text-gray-500 pt-4">To reschedule or cancel an appointment, please call the business.</p>
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

        </>
      )}
    </div>
  );
};

export default CustomerDashboard;
