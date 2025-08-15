// src/App.tsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import CustomerDashboard from "./pages/CustomerDashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import CustomerProfile from "./pages/CustomerProfile";
import BusinessProfile from "./pages/BusinessProfile";
import BusinessPublicProfile from "./pages/BusinessPublicProfile";
import BusinessDashboard from "./pages/BusinessDashboard";
import "react-datepicker/dist/react-datepicker.css";
import BusinessCreateAppointment from "./pages/BusinessCreateAppointment";
import BusinessPastAppointments from "./pages/BusinessPastAppointments";
import VerifyEmail from "./pages/VerifyEmail"; // NEW

function App() {
  return (
    <Router>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} /> {/* NEW */}
        <Route path="/business/:id" element={<BusinessPublicProfile />} />

        {/* Customer-only */}
        <Route
          path="/appointments"
          element={
            <ProtectedRoute requiredRole="customer">
              <CustomerDashboard />
            </ProtectedRoute>
          }
        />

        {/* Admin-only (grouped) */}
        <Route
          element={<ProtectedRoute requiredRole="admin" />}
        >
          <Route path="/dashboard" element={<BusinessDashboard />} />
          <Route path="/dashboard/create-appointment" element={<BusinessCreateAppointment />} />
          <Route path="/dashboard/create-appointment/:apptId" element={<BusinessCreateAppointment />} />
          <Route path="/dashboard/appointments/past" element={<BusinessPastAppointments />} />
          <Route path="/profile/business" element={<BusinessProfile />} />
        </Route>

        {/* Customer profile (if this is private to logged-in customers) */}
        <Route
          path="/profile/customer"
          element={
            <ProtectedRoute requiredRole="customer">
              <CustomerProfile />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
