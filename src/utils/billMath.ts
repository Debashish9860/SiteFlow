/**
 * Money arithmetic for a bill.
 *
 * Deliberately free of storage, navigation and React so the numbers that
 * decide how much a customer still owes can be tested on their own.
 */

export interface BillMoney {
  subtotal: number;
  discount?: number;
  advancePaid?: number;
  /** Tax or retention the client has withheld across all payments so far. */
  taxDeducted?: number;
}

export interface PaymentInput {
  amountReceived: number;
  /** Tax or retention withheld as part of this payment. */
  taxDeduction?: number;
  /** Close the bill whatever is left on it. */
  markAsSettled?: boolean;
}

export interface PaymentOutcome {
  totalPaid: number;
  taxDeducted: number;
  balanceDue: number;
  isSettled: boolean;
}

/** What the bill is worth once its discount is applied. */
export function netTotalOf(bill: BillMoney): number {
  return Math.max(0, (Number(bill.subtotal) || 0) - (Number(bill.discount) || 0));
}

/**
 * Apply a payment to a bill and report where that leaves it.
 *
 * The balance subtracts every rupee withheld so far, not only the deduction
 * attached to this payment. Counting just the newest one left all the earlier
 * deductions sitting in the balance, so a bill settled across two part-payments
 * never reached zero and went on showing money owed that nobody owed.
 */
export function computePaymentUpdate(bill: BillMoney, payment: PaymentInput): PaymentOutcome {
  const netTotal = netTotalOf(bill);
  const currentPaid = Number(bill.advancePaid) || 0;
  const received = Math.max(0, Number(payment.amountReceived) || 0);
  const totalPaid = Math.min(netTotal, currentPaid + received);

  const taxDeducted = (Number(bill.taxDeducted) || 0) + (Number(payment.taxDeduction) || 0);
  const balanceDue = payment.markAsSettled
    ? 0
    : Math.max(0, netTotal - (totalPaid + taxDeducted));

  return {
    totalPaid,
    taxDeducted,
    balanceDue,
    isSettled: Boolean(payment.markAsSettled || balanceDue === 0),
  };
}
