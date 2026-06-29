import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { CartProvider } from "./cart/CartContext";
import { Layout } from "./components/Layout";
import { CatalogPage } from "./pages/CatalogPage";
import { ProductPage } from "./pages/ProductPage";
import { CheckoutPage } from "./pages/CheckoutPage";
import { OrderConfirmationPage } from "./pages/OrderConfirmationPage";
import { MyOrdersPage } from "./pages/MyOrdersPage";
import { ChatPage } from "./pages/ChatPage";

const queryClient = new QueryClient();

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <CartProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<CatalogPage />} />
              <Route path="/products/:id" element={<ProductPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/order-confirmation" element={<OrderConfirmationPage />} />
              <Route path="/my-orders" element={<MyOrdersPage />} />
              <Route path="/chat" element={<ChatPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </QueryClientProvider>
  );
}
