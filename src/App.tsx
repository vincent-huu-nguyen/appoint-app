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

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* 🔒 Protected Routes */}
        <Route
          path="/appointments"
          element={
            <ProtectedRoute requiredRole="customer">
              <CustomerDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute requiredRole="admin">
              <BusinessDashboard />
            </ProtectedRoute>
          }
        />

        <Route path="/dashboard/create-appointment" element={<BusinessCreateAppointment />} />
        <Route path="/dashboard/create-appointment/:apptId" element={<BusinessCreateAppointment />} />
        <Route path="/dashboard/appointments/past" element={<BusinessPastAppointments />} />

        {/* 👤 Profile Setup Pages */}
        <Route path="/profile/customer" element={<CustomerProfile />} />
        <Route path="/profile/business" element={<BusinessProfile />} />

        {/* Business Public Profile */}
        <Route path="/business/:id" element={<BusinessPublicProfile />} />
      </Routes>
    </Router>
  );
}

export default App;
