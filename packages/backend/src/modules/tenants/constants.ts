export const RESERVED_SUBDOMAINS = new Set([
  "www",
  "admin",
  "superadmin",
  "api",
  "app",
  "mail",
  "ftp",
]);

// Min length 3 to match the registration schema (subdomain min(3)) so
// /check-subdomain and /register never disagree on validity.
const SUBDOMAIN_PATTERN = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

export function isValidSubdomain(value: string): boolean {
  return SUBDOMAIN_PATTERN.test(value) && !RESERVED_SUBDOMAINS.has(value);
}
