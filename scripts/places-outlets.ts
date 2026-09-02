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
  // ── Kota & Kabupaten Bogor ──────────────────────────────────────────────
  { name: "Suka Shawarma Empang", city: "Bogor", searchQuery: "SUKA Shawarma Empang, Jl. Pahlawan No. 10A, Bogor Selatan" },
  { name: "Suka Shawarma Paledang", city: "Bogor", searchQuery: "SUKA Shawarma Paledang, Jl. Paledang No. 18, Panaragan, Bogor Tengah" },
  { name: "Suka Shawarma Cimanggu", city: "Bogor", searchQuery: "SUKA Shawarma Cimanggu, Ruko Bukit Cimanggu City Raya, Tanah Sareal, Bogor" },
  { name: "Suka Shawarma Pajajaran", city: "Bogor", searchQuery: "SUKA Shawarma Pajajaran, Jl. Raya Pajajaran No. 21, Sukasari, Bogor Timur" },
  { name: "Suka Shawarma Dramaga", city: "Bogor", searchQuery: "SUKA Shawarma Dramaga, Jl. Raya Dramaga No. 15, Margajaya, Bogor" },
  { name: "Suka Shawarma Sentul", city: "Bogor", searchQuery: "SUKA Shawarma Sentul, Jl. Raya Babakan Madang, Bogor" },
  { name: "Suka Shawarma Cibinong", city: "Bogor", searchQuery: "SUKA Shawarma Cibinong, Jl. Raya Sukahati No. 35, Cibinong, Bogor" },
  { name: "Suka Shawarma Ciseeng", city: "Bogor", searchQuery: "SUKA Shawarma Ciseeng, Jl. H. Mawi No. 17, Parigi Mekar, Bogor" },
  { name: "Suka Shawarma Kota Wisata Cibubur", city: "Bogor", searchQuery: "SUKA Shawarma Kota Wisata Cibubur, Ruko Fresh Market, Jl. Boulevard Kota Wisata, Gunung Putri, Bogor" },
  { name: "Suka Shawarma Metland Cileungsi", city: "Bogor", searchQuery: "SUKA Shawarma Metland Cileungsi, Jl. Boulevard Metland Cileungsi No. 19, Bogor" },

  // ── Depok & Tangerang Selatan ───────────────────────────────────────────
  { name: "Suka Shawarma Beji", city: "Depok", searchQuery: "SUKA Shawarma Beji, Jl. H. Asmawi No. 44, Beji, Depok" },
  { name: "Suka Shawarma Sawangan", city: "Depok", searchQuery: "SUKA Shawarma Sawangan, Jl. Raya Parung Bingung No. 49, Pancoran Mas, Depok" },
  { name: "Suka Shawarma Depok Sukmajaya", city: "Depok", searchQuery: "SUKA Shawarma Depok Sukmajaya, Jl. K.H.M. Yusuf Raya, Mekar Jaya, Sukmajaya, Depok" },
  { name: "Suka Shawarma Cirendeu", city: "Tangerang Selatan", searchQuery: "SUKA Shawarma Cirendeu, Jl. Raya Cirendeu, Ciputat Timur, Tangerang Selatan" },

  // ── Jakarta ─────────────────────────────────────────────────────────────
  { name: "Suka Shawarma Jagakarsa", city: "Jakarta Selatan", searchQuery: "SUKA Shawarma Jagakarsa, Jl. Raya Jagakarsa No. 159, Jakarta Selatan" },
  { name: "Suka Shawarma Kalisari", city: "Jakarta Timur", searchQuery: "SUKA Shawarma Kalisari, Jl. Kalisari No. 13, Pasar Rebo, Jakarta Timur" },

  // ── Bekasi & Sukabumi ───────────────────────────────────────────────────
  { name: "Suka Shawarma Pekayon", city: "Bekasi", searchQuery: "SUKA Shawarma Pekayon, Ruko Peninsula, Jl. Pulo Ribung No. 1, Pekayon Jaya, Bekasi Selatan" },
  { name: "Suka Shawarma Jatiwaringin", city: "Bekasi", searchQuery: "SUKA Shawarma Jatiwaringin, Jl. Raya Jatiwaringin No. 51, Pondok Gede, Bekasi" },
  // Marked "Tutup Sementara" (temporarily closed) in the source listing —
  // still included so it can be tracked; drop this entry if it's closed
  // for good.
  { name: "Suka Shawarma Jatiasih", city: "Bekasi", searchQuery: "SUKA Shawarma Jatiasih, Jl. Raya Mess AL No. 10, Jatisari, Jatiasih, Bekasi" },
  { name: "Suka Shawarma Cicurug", city: "Sukabumi", searchQuery: "SUKA Shawarma Cicurug, Jl. Siliwangi, Cicurug, Sukabumi" },
];
