import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import PublicLayout from "@/components/layout/PublicLayout";
import Home from "@/pages/public/Home";
import MotorList from "@/pages/public/MotorList";
import MotorDetail from "@/pages/public/MotorDetail";
import Booking from "@/pages/public/Booking";
import BookingSuccess from "@/pages/public/BookingSuccess";
import Payment from "@/pages/public/Payment";
import Receipt from "@/pages/public/Receipt";
import TrackBooking from "@/pages/public/TrackBooking";

import AdminLogin from "@/pages/admin/AdminLogin";
import AdminGuard from "@/pages/admin/AdminGuard";
import Dashboard from "@/pages/admin/Dashboard";
import Bookings from "@/pages/admin/Bookings";
import BookingDetail from "@/pages/admin/BookingDetail";
import Pickup from "@/pages/admin/Pickup";
import Returns from "@/pages/admin/Returns";
import MotorTypes from "@/pages/admin/MotorTypes";
import MotorUnits from "@/pages/admin/MotorUnits";
import SettingsPage from "@/pages/admin/Settings";
import Reports from "@/pages/admin/Reports";
import Customers from "@/pages/admin/Customers";
import Payments from "@/pages/admin/Payments";
import Terms from "@/pages/public/Terms";
import PrivacyPolicy from "@/pages/public/PrivacyPolicy";
import Contact from "@/pages/public/Contact";
import Maintenance from "@/pages/admin/Maintenance";

const qc = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/motor" element={<MotorList />} />
            <Route path="/motor/:slug" element={<MotorDetail />} />
            <Route path="/booking" element={<Booking />} />
            <Route path="/booking/success" element={<BookingSuccess />} />
            <Route path="/payment/:bookingCode" element={<Payment />} />
            <Route path="/receipt/:bookingCode" element={<Receipt />} />
            <Route path="/track-booking" element={<TrackBooking />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/contact" element={<Contact />} />
          </Route>

          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminGuard />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="bookings" element={<Bookings />} />
            <Route path="bookings/:code" element={<BookingDetail />} />
            <Route path="rentals/pickup" element={<Pickup />} />
            <Route path="rentals/returns" element={<Returns />} />
            <Route path="motor-types" element={<MotorTypes />} />
            <Route path="motor-units" element={<MotorUnits />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="reports" element={<Reports />} />
            <Route path="customers" element={<Customers />} />
            <Route path="payments" element={<Payments />} />
            <Route path="maintenance" element={<Maintenance />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
