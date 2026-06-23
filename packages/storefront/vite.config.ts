import { defineConfig, type ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";

// Vite's proxy rewrites the Host header to the target even when changeOrigin
// is left at its default - empirically verified (direct request to the
// backend with a spoofed Host header resolves the tenant fine; the same
// request through this proxy came back 404 SHOP_NOT_FOUND). The backend's
// subdomain-based tenant resolution needs the *original* browser Host
// header, so force it back via configure().
const preserveHostProxy: ProxyOptions = {
  target: "http://localhost:4000",
  changeOrigin: false,
  configure: (proxy) => {
    proxy.on("proxyReq", (proxyReq, req) => {
      if (req.headers.host) proxyReq.setHeader("host", req.headers.host);
    });
  },
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    // Allow arbitrary *.localhost dev hostnames (shop.localhost:5174) so the
    // backend's subdomain-based tenant resolution works in local dev too.
    allowedHosts: true,
    proxy: {
      "/api": preserveHostProxy,
      "/uploads": preserveHostProxy,
    },
  },
});
