// In development set VITE_ADMIN_URL=http://localhost:5173 in .env.local.
// Production defaults to the live admin app so the landing's "Войти" button
// and post-registration redirect work without any extra env configuration.
export const ADMIN_URL: string = import.meta.env.VITE_ADMIN_URL ?? "https://app.ubazaar.uz";
