export interface Plan {
  id: string;
  code: string;
  name: string;
  priceSum: number;
  maxProducts: number | null;
  maxOrdersPerMonth: number | null;
  maxEmployees: number | null;
  features: Record<string, string>;
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}
