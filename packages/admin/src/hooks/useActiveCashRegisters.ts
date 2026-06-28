import { useQuery } from "@tanstack/react-query";
import * as cashRegistersApi from "../api/cashRegisters";

export function useActiveCashRegisters() {
  const query = useQuery({ queryKey: ["finance", "cash-registers"], queryFn: cashRegistersApi.listCashRegisters });
  const registers = query.data?.items ?? [];
  const activeRegisters = registers.filter((r) => r.isActive);
  const defaultRegisterId = registers.find((r) => r.isDefault)?.id ?? activeRegisters[0]?.id ?? "";
  return { registers, activeRegisters, defaultRegisterId };
}
