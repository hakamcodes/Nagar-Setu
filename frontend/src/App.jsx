import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/layout/AppShell.jsx";
import ProtectedRoute from "./components/layout/ProtectedRoute.jsx";
import Home from "./pages/Home.jsx";
import SignIn from "./pages/SignIn.jsx";
import ReportIssue from "./pages/ReportIssue.jsx";
import ComplaintFeed from "./pages/ComplaintFeed.jsx";
import ComplaintDetail from "./pages/ComplaintDetail.jsx";
import MyComplaints from "./pages/MyComplaints.jsx";
import SupportedIssues from "./pages/SupportedIssues.jsx";
import Settings from "./pages/Settings.jsx";
import NotFound from "./pages/NotFound.jsx";

const MapPage = lazy(() => import("./pages/MapPage.jsx"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard.jsx"));
const AdminComplaints = lazy(() => import("./pages/admin/AdminComplaints.jsx"));
const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics.jsx"));
const AdminZones = lazy(() => import("./pages/admin/AdminZones.jsx"));
const AdminOfficers = lazy(() => import("./pages/admin/AdminOfficers.jsx"));

const OFFICER_ROLES = ["junior-officer", "senior-officer", "super-admin"];

function LoadingScreen() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-card">
        Loading Nagar Setu...
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Home />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/report" element={<ProtectedRoute><ReportIssue /></ProtectedRoute>} />
          <Route path="/complaints" element={<ComplaintFeed />} />
          <Route path="/complaints/:complaintId" element={<ComplaintDetail />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/my-complaints" element={<ProtectedRoute><MyComplaints /></ProtectedRoute>} />
          <Route path="/supported" element={<ProtectedRoute><SupportedIssues /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute roles={OFFICER_ROLES}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/complaints" element={<ProtectedRoute roles={OFFICER_ROLES}><AdminComplaints /></ProtectedRoute>} />
          <Route path="/admin/analytics" element={<ProtectedRoute roles={OFFICER_ROLES}><AdminAnalytics /></ProtectedRoute>} />
          <Route path="/admin/zones" element={<ProtectedRoute roles={OFFICER_ROLES}><AdminZones /></ProtectedRoute>} />
          <Route path="/admin/officers" element={<ProtectedRoute roles={["super-admin"]}><AdminOfficers /></ProtectedRoute>} />
          <Route path="/dashboard" element={<Navigate to="/admin" replace />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
