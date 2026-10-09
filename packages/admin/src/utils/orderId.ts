// The short form of an order's ID shown across the admin and the storefront
// ("#1a2b3c4d") - also what the Kassa's Excel payment import accepts.
export function shortOrderId(id: string): string {
  return `#${id.slice(0, 8)}`;
}
