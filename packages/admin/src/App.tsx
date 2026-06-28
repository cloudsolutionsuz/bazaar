import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";
import { AcceptInvitePage } from "./pages/AcceptInvitePage";
import { DashboardPage } from "./pages/DashboardPage";
import { CustomersListPage } from "./pages/customers/CustomersListPage";
import { CustomerDetailPage } from "./pages/customers/CustomerDetailPage";
import { ProductsListPage } from "./pages/products/ProductsListPage";
import { ProductFormPage } from "./pages/products/ProductFormPage";
import { InventoryPage } from "./pages/inventory/InventoryPage";
import { SuppliersListPage } from "./pages/suppliers/SuppliersListPage";
import { BannersPage } from "./pages/banners/BannersPage";
import { OrdersListPage } from "./pages/orders/OrdersListPage";
import { OrderDetailPage } from "./pages/orders/OrderDetailPage";
import { BillingPage } from "./pages/billing/BillingPage";
import { EmployeesPage } from "./pages/employees/EmployeesPage";
import { SettingsPage } from "./pages/SettingsPage";
import { KassaPage } from "./pages/finance/KassaPage";
import { ReportsPage } from "./pages/finance/ReportsPage";
import { TenantsListPage } from "./pages/platform/TenantsListPage";
import { TenantDetailPage } from "./pages/platform/TenantDetailPage";
import { PlansPage } from "./pages/platform/PlansPage";

const queryClient = new QueryClient();

// SUPER_ADMIN has no tenant, so the tenant-scoped pages (/products etc.)
// would error out for them - send each role to its own home page instead.
// CASHIER has no access to /dashboard or /products (both OWNER/MANAGER-only
// on the backend), so it gets its own landing page among the pages it can use.
function RoleHome() {
  const { user } = useAuth();
  if (user?.role === "SUPER_ADMIN") return <Navigate to="/platform/tenants" replace />;
  if (user?.role === "CASHIER") return <Navigate to="/orders" replace />;
  return <Navigate to="/dashboard" replace />;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/accept-invite" element={<AcceptInvitePage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/" element={<RoleHome />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/customers" element={<CustomersListPage />} />
                <Route path="/customers/:id" element={<CustomerDetailPage />} />
                <Route path="/products" element={<ProductsListPage />} />
                <Route path="/products/:id" element={<ProductFormPage />} />
                <Route path="/inventory" element={<InventoryPage />} />
                <Route path="/suppliers" element={<SuppliersListPage />} />
                <Route path="/banners" element={<BannersPage />} />
                <Route path="/orders" element={<OrdersListPage />} />
                <Route path="/orders/:id" element={<OrderDetailPage />} />
                <Route path="/billing" element={<BillingPage />} />
                <Route path="/employees" element={<EmployeesPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/kassa" element={<KassaPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/platform/tenants" element={<TenantsListPage />} />
                <Route path="/platform/tenants/:id" element={<TenantDetailPage />} />
                <Route path="/platform/plans" element={<PlansPage />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
