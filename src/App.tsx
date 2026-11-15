import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/auth/ProtectedRoute'
import NotificationsPage from './features/notifications/pages/NotificationsPage'

import LogisticsQuotesPage from './features/logistics/pages/LogisticsQuotesPage'

// Pages
import LoginPage from './features/auth/pages/LoginPage'
import DashboardPage from './features/dashboard/pages/DashboardPage'
import OrdersPage from './features/orders/pages/OrdersPage'
import RidersPage from './features/riders/pages/RidersPage'
import LiveMapPage from './features/livemap/pages/LiveMapPage'
import CustomersPage from './features/customers/pages/CustomersPage'
import RestaurantsPage from './features/restaurants/pages/RestaurantsPage'
import RestaurantDetailPage from './features/restaurants/pages/RestaurantDetailPage'
import RestaurantMenuPage from './features/restaurants/pages/RestaurantMenuPage'
import ApprovalsPage from './features/approvals/pages/ApprovalsPage'
import ReviewApplicationPage from './features/approvals/pages/ReviewApplicationPage'
import ReportsPage from './features/reports/pages/ReportsPage'
import PaymentPage from './features/payments/pages/PaymentPage'
import SettingsPage from './features/settings/pages/SettingsPage'
import SupportPage from './features/support/pages/SupportPage'
import TicketDetailPage from './features/support/pages/TicketDetailPage'
import TeamsPage from './features/teams/pages/TeamsPage'
import DataManagementPage from './features/data-management/pages/DataManagementPage'
import ReferralsPage from './features/referrals/pages/ReferralsPage'
import WaitlistPage from './features/waitlist/pages/WaitlistPage'
import EventsPage from './features/events/pages/EventsPage'
import EventFormPage from './features/events/pages/EventFormPage'
import EventSalesPage from './features/events/pages/EventSalesPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected Routes */}
        <Route path="/" element={<ProtectedRoute><Navigate to="/dashboard" replace /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/logistics-quotes" element={<ProtectedRoute><LogisticsQuotesPage /></ProtectedRoute>} />
        <Route path="/orders" element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
        <Route path="/riders" element={<ProtectedRoute><RidersPage /></ProtectedRoute>} />
        <Route path="/live-map" element={<ProtectedRoute><LiveMapPage /></ProtectedRoute>} />
        <Route path="/customers" element={<ProtectedRoute><CustomersPage /></ProtectedRoute>} />

        {/* Restaurant Routes */}
        <Route path="/restaurants" element={<ProtectedRoute><RestaurantsPage /></ProtectedRoute>} />
        <Route path="/restaurants/:id" element={<ProtectedRoute><RestaurantDetailPage /></ProtectedRoute>} />
        <Route path="/restaurants/:id/menu" element={<ProtectedRoute><RestaurantMenuPage /></ProtectedRoute>} />

        {/* Approval Routes */}
        <Route path="/approvals" element={<ProtectedRoute><ApprovalsPage /></ProtectedRoute>} />
        <Route path="/approvals/:id" element={<ProtectedRoute><ReviewApplicationPage /></ProtectedRoute>} />

        {/* Feature Routes */}
        <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
        <Route path="/payments" element={<ProtectedRoute><PaymentPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="/referrals" element={<ProtectedRoute><ReferralsPage /></ProtectedRoute>} />
        <Route path="/waitlist" element={<ProtectedRoute><WaitlistPage /></ProtectedRoute>} />
        <Route path="/teams" element={<ProtectedRoute><TeamsPage /></ProtectedRoute>} />

        {/* Event ticketing. /events/new must precede /events/:id or the
            router would match "new" as an event id. */}
        <Route path="/events" element={<ProtectedRoute><EventsPage /></ProtectedRoute>} />
        <Route path="/events/new" element={<ProtectedRoute><EventFormPage /></ProtectedRoute>} />
        <Route path="/events/:id" element={<ProtectedRoute><EventFormPage /></ProtectedRoute>} />
        <Route path="/events/:id/sales" element={<ProtectedRoute><EventSalesPage /></ProtectedRoute>} />
        <Route path="/data-management" element={<ProtectedRoute><DataManagementPage /></ProtectedRoute>} />

        <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />

        {/* Support Routes */}
        <Route path="/support" element={<ProtectedRoute><SupportPage /></ProtectedRoute>} />
        <Route path="/support/:id" element={<ProtectedRoute><TicketDetailPage /></ProtectedRoute>} />

        {/* Catch all - redirect to dashboard */}
        <Route path="*" element={<ProtectedRoute><Navigate to="/dashboard" replace /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
