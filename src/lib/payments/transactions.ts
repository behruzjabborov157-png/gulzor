/** Common view of provider transactions. Payme states: 1, 2, -1, -2. Click states: 0 prepared, 1 completed, -1 cancelled. */
export type TxStatus = "pending" | "paid" | "cancelled" | "refunded";

export function txStatus(provider: string, state: number): TxStatus {
  if (provider === "payme") return state === 2 ? "paid" : state === 1 ? "pending" : state === -2 ? "refunded" : "cancelled";
  return state === 1 ? "paid" : state === 0 ? "pending" : "cancelled";
}

/** State values of a status per provider, for filtering in the database. */
export const TX_STATES: Record<string, Record<TxStatus, number[]>> = {
  payme: { pending: [1], paid: [2], cancelled: [-1], refunded: [-2] },
  click: { pending: [0], paid: [1], cancelled: [-1], refunded: [] },
};
