/**
 * Real Suka Shawarma outlets to resolve via scripts/resolve-places.ts.
 * Edit this list, then run `npm run resolve-places`.
 */
export interface RealOutletInput {
  name: string;
  city: string;
  searchQuery: string;
}

export const REAL_OUTLETS: RealOutletInput[] = [
  // { name: "Suka Shawarma Cibubur", city: "Jakarta Timur", searchQuery: "Suka Shawarma Cibubur, Jakarta Timur" },
];
