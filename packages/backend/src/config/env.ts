import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  baseDomain: process.env.BASE_DOMAIN ?? "localhost",
  databaseUrl: required("DATABASE_URL"),

  jwtAccessSecret: required("JWT_ACCESS_SECRET"),
  jwtRefreshSecret: required("JWT_REFRESH_SECRET"),
  jwtAccessTtl: process.env.JWT_ACCESS_TTL ?? "15m",
  jwtRefreshTtlDays: Number(process.env.JWT_REFRESH_TTL_DAYS ?? 30),

  trialDays: Number(process.env.TRIAL_DAYS ?? 7),
  landingUrl: process.env.LANDING_URL ?? "http://localhost:5175",
  adminUrl: process.env.ADMIN_URL ?? "http://localhost:5173",

  superadminEmail: process.env.SUPERADMIN_EMAIL ?? "superadmin@bazaar.uz",
  superadminPassword: process.env.SUPERADMIN_PASSWORD ?? "change-me-super-secret",
};
