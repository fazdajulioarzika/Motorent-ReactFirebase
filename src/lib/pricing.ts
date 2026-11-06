export type PaymentType = "dp" | "full";

export interface PricingConfig {
  toleranceMinutes: number;
  minDays: number;
  depositAmount: number;
  dpPercent: number;
}

export interface Pricing {
  dailyPrice: number;
  duration: number;
  rentalCost: number;
  deposit: number;
  total: number;
  requiredPayment: number;
  paidAmount: number;
  remainingAmount: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function calculateDuration(
  pickupAt: Date,
  returnAt: Date,
  cfg: PricingConfig
): number {
  const diff = returnAt.getTime() - pickupAt.getTime();
  if (!Number.isFinite(diff) || diff <= 0) return 0;
  const fullDays = Math.floor(diff / DAY_MS);
  const remainderMin = (diff - fullDays * DAY_MS) / 60000;
  const days = remainderMin > cfg.toleranceMinutes ? fullDays + 1 : fullDays;
  return Math.max(days, cfg.minDays);
}

export function calculatePricing(
  dailyPrice: number,
  duration: number,
  paymentType: PaymentType,
  cfg: PricingConfig
): Pricing {
  const rentalCost = dailyPrice * duration;
  const deposit = cfg.depositAmount;
  const total = rentalCost + deposit;
  const requiredPayment =
    paymentType === "full"
      ? total
      : Math.round((rentalCost * cfg.dpPercent) / 100);
  return {
    dailyPrice,
    duration,
    rentalCost,
    deposit,
    total,
    requiredPayment,
    paidAmount: 0,
    remainingAmount: total,
  };
}
