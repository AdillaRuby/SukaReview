import { format, formatDistanceToNowStrict, isToday, isYesterday } from "date-fns";
import { id } from "date-fns/locale";

/** "31 Agu 2026" */
export function formatDateID(value: string | Date): string {
  return format(new Date(value), "d MMM yyyy", { locale: id });
}

/** "2 menit lalu" / "5 jam lalu" / "Kemarin" / "31 Agu 2026" */
export function formatRelativeID(value: string | Date): string {
  const date = new Date(value);
  if (isToday(date)) {
    return `${formatDistanceToNowStrict(date, { locale: id })} lalu`;
  }
  if (isYesterday(date)) {
    return "Kemarin";
  }
  return formatDateID(date);
}

/** "14:32" */
export function formatTimeID(value: string | Date): string {
  return format(new Date(value), "HH:mm");
}

export function formatNumberID(value: number): string {
  return new Intl.NumberFormat("id-ID").format(value);
}

export function formatRating(value: number): string {
  return value.toFixed(1);
}
