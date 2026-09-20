const inr = new Intl.NumberFormat("en-IN");

export const money = (amount: number) => `₹${inr.format(Math.round(amount || 0))}`;

/** Big-number display: 1.25 Cr / 45 L / 8,000. Keeps the hero counters short. */
export function shortMoney(amount: number) {
  const value = Math.round(amount || 0);
  if (value >= 10000000) return { value: trim(value / 10000000), unit: "Cr" };
  if (value >= 100000) return { value: trim(value / 100000), unit: "L" };
  if (value >= 1000) return { value: trim(value / 1000), unit: "K" };
  return { value: inr.format(value), unit: "" };
}

function trim(value: number) {
  return (value >= 100 ? value.toFixed(0) : value.toFixed(2)).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

export const CRORE = 10000000;
