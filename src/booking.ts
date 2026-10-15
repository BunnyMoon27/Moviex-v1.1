export const PRICE = 260;
export const unavailable = new Set([
  "A3",
  "A4",
  "B7",
  "B8",
  "C2",
  "C3",
  "D8",
  "E4",
  "E5",
  "F9",
  "G1",
  "G2",
]);
export function toggleSeat(selected: string[], seat: string, blocked: ReadonlySet<string> = unavailable): string[] {
  if (!/^[A-G](?:[1-9]|10)$/.test(seat) || blocked.has(seat))
    return selected;
  return selected.includes(seat)
    ? selected.filter((s) => s !== seat)
    : [...selected, seat].sort(
        (a, b) =>
          a[0].localeCompare(b[0]) || Number(a.slice(1)) - Number(b.slice(1)),
      );
}
export function total(selected: string[]) {
  return selected.length * PRICE;
}
export const money = (amount: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
    amount,
  );
