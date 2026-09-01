import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Escapes a value for safe interpolation into a PostgREST `.or()` filter
 * string. Reserved characters (comma, parens, dot, colon) split the DSL into
 * extra filter clauses if left raw, so wrap the value in double quotes per
 * PostgREST's quoting rules and escape any backslash/quote inside it.
 */
export function escapeOrFilterValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
