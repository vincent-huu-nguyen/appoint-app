import React, { ReactNode, useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

type Props = {
  requiredRole?: "admin" | "customer";
  children?: ReactNode; // make optional so it can be used as a wrapper
};

const ProtectedRoute = ({ children, requiredRole }: Props) => {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  // Ensure we have the freshest emailVerified value
  const [refreshed, setRefreshed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const doReload = async () => {
      try {
        if (user?.reload) {
          await user.reload();
        }
      } finally {
        if (!cancelled) setRefreshed(true);
      }
    };

    if (loading) {
      // wait for context to finish first
      return;
    }

    if (!user) {
      // no user; don't bother reloading
      setRefreshed(true);
      return;
    }

    // reload once per user session
    setRefreshed(false);
    void doReload();

    return () => {
      cancelled = true;
    };
  }, [user, loading]);

  // Global loading (auth context)
  if (loading) {
    return <p className="text-center mt-10">Loading...</p>;
  }

  // Not logged in → kick to login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Wait until we've refreshed the user before checking emailVerified
  if (!refreshed) {
    return <p className="text-center mt-10">Checking access…</p>;
  }

  // Enforce email verification
  if (!user.emailVerified) {
    return (
      <Navigate
        to="/verify-email"
        state={{ email: user.email, from: location }}
        replace
      />
    );
  }

  // Enforce role if required
  if (requiredRole && role !== requiredRole) {
    // send them home (or wherever you prefer)
    return <Navigate to="/" replace />;
  }

  // Support both usages:
  // 1) <ProtectedRoute requiredRole="customer"><CustomerDashboard/></ProtectedRoute>
  // 2) <Route element={<ProtectedRoute requiredRole="admin" />}><Route ... /></Route>
  return children ? <>{children}</> : <Outlet />;
};

export default ProtectedRoute;
