// Spread into any order-creation request body in tests - createOrderSchema
// requires all three address fields now, and "chilanzar" is a real district
// of the "tashkent_city" region in src/data/uzbekistanRegions.ts.
export const DEFAULT_ADDRESS = {
  addressRegion: "tashkent_city",
  addressDistrict: "chilanzar",
  addressMahalla: "Test Mahalla",
};

// Storefront checkout requires a second contact number (createStorefrontOrderSchema).
export const SECOND_PHONE = { additionalPhones: ["+998900000100"] };
