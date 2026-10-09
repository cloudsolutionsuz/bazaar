import type { SaleUnit } from "../types/api";

export interface UnitOption {
  unit: SaleUnit;
  // How many pieces one of this unit holds (1 for a piece).
  size: number;
}

export const UNIT_LABEL_KEYS: Record<SaleUnit, string> = {
  PIECE: "units.piece",
  BLOCK: "units.block",
  BOX: "units.box",
};

// The ways a product can be bought: always by the piece, plus by the block
// and/or box when the shop has set how many pieces those hold.
export function unitOptionsFor(product: { piecesPerBlock: number | null; piecesPerBox: number | null }): UnitOption[] {
  return [
    { unit: "PIECE", size: 1 },
    ...(product.piecesPerBlock ? [{ unit: "BLOCK" as const, size: product.piecesPerBlock }] : []),
    ...(product.piecesPerBox ? [{ unit: "BOX" as const, size: product.piecesPerBox }] : []),
  ];
}
