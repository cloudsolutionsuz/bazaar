function toInputValue(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function todayInputValue(): string {
  return toInputValue(new Date());
}

export function monthStartInputValue(): string {
  const now = new Date();
  return toInputValue(new Date(now.getFullYear(), now.getMonth(), 1));
}

export function monthEndInputValue(): string {
  const now = new Date();
  return toInputValue(new Date(now.getFullYear(), now.getMonth() + 1, 0));
}

// <input type="date"> values as the inclusive day-range the API expects.
export function dayStartParam(date: string): string | undefined {
  return date ? `${date}T00:00:00` : undefined;
}

export function dayEndParam(date: string): string | undefined {
  return date ? `${date}T23:59:59.999` : undefined;
}
