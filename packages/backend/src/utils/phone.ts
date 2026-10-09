// Strips everything but digits so "+998 90 123-45-67" and "998901234567"
// resolve to the same Customer - phone is the mini-account's identity key.
export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

// A normalized Uzbek number: country code 998 followed by exactly 9 digits.
const UZ_PHONE_PATTERN = /^998\d{9}$/;

export function isUzPhone(normalized: string): boolean {
  return UZ_PHONE_PATTERN.test(normalized);
}

// Accepts the number with or without the country code ("901234567",
// "+998 90 123-45-67") and returns the stored form, or null if it isn't a
// valid Uzbek number.
// Only what a phone number is ever written with; anything else (letters
// above all) makes the whole value invalid instead of being stripped away.
const PHONE_CHARACTERS = /^\+?[\d\s()-]+$/;

export function toUzPhone(raw: string): string | null {
  if (!PHONE_CHARACTERS.test(raw.trim())) return null;
  const digits = normalizePhone(raw);
  const full = digits.length === 9 ? `998${digits}` : digits;
  return isUzPhone(full) ? full : null;
}
