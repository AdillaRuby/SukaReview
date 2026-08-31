import type { GoogleAccount, GoogleLocation } from "@/types/google";
import type { ReviewCategoryTag, Sentiment, Urgency } from "@/types/database";

/**
 * Realistic mock data for GOOGLE_MODE=demo. Purely fictional — these outlet
 * names/addresses are NOT official Suka Shawarma production data, only
 * placeholders so the UI has something believable to render.
 */

export const demoAccount: GoogleAccount = {
  accountId: "demo-account-suka-shawarma",
  accountName: "Suka Shawarma",
  type: "ORGANIZATION",
};

export interface DemoOutletSeed {
  locationId: string;
  name: string;
  slug: string;
  city: string;
  address: string;
  latitude: number;
  longitude: number;
}

export const DEMO_OUTLETS: DemoOutletSeed[] = [
  { locationId: "locations/demo-001", name: "Suka Shawarma Cibubur", slug: "cibubur", city: "Jakarta Timur", address: "Jl. Alternatif Cibubur No. 45", latitude: -6.3729, longitude: 106.9256 },
  { locationId: "locations/demo-002", name: "Suka Shawarma Bekasi", slug: "bekasi", city: "Bekasi", address: "Jl. Ahmad Yani No. 12, Bekasi Selatan", latitude: -6.2383, longitude: 106.9756 },
  { locationId: "locations/demo-003", name: "Suka Shawarma Depok", slug: "depok", city: "Depok", address: "Jl. Margonda Raya No. 88", latitude: -6.3728, longitude: 106.8317 },
  { locationId: "locations/demo-004", name: "Suka Shawarma Bogor", slug: "bogor", city: "Bogor", address: "Jl. Pajajaran No. 30", latitude: -6.5971, longitude: 106.8060 },
  { locationId: "locations/demo-005", name: "Suka Shawarma Tangerang", slug: "tangerang", city: "Tangerang", address: "Jl. Sudirman No. 5, Tangerang", latitude: -6.1783, longitude: 106.6319 },
  { locationId: "locations/demo-006", name: "Suka Shawarma BSD", slug: "bsd", city: "Tangerang Selatan", address: "Jl. Pahlawan Seribu, BSD City", latitude: -6.3016, longitude: 106.6528 },
  { locationId: "locations/demo-007", name: "Suka Shawarma Kelapa Gading", slug: "kelapa-gading", city: "Jakarta Utara", address: "Jl. Boulevard Raya Blok QJ", latitude: -6.1588, longitude: 106.9056 },
  { locationId: "locations/demo-008", name: "Suka Shawarma Pondok Indah", slug: "pondok-indah", city: "Jakarta Selatan", address: "Jl. Metro Pondok Indah No. 18", latitude: -6.2659, longitude: 106.7838 },
  { locationId: "locations/demo-009", name: "Suka Shawarma Kemang", slug: "kemang", city: "Jakarta Selatan", address: "Jl. Kemang Raya No. 21", latitude: -6.2607, longitude: 106.8133 },
  { locationId: "locations/demo-010", name: "Suka Shawarma Bandung Dago", slug: "bandung-dago", city: "Bandung", address: "Jl. Ir. H. Djuanda No. 100", latitude: -6.8827, longitude: 107.6134 },
  { locationId: "locations/demo-011", name: "Suka Shawarma Bandung Buah Batu", slug: "bandung-buah-batu", city: "Bandung", address: "Jl. Buah Batu No. 60", latitude: -6.9481, longitude: 107.6318 },
  { locationId: "locations/demo-012", name: "Suka Shawarma Cikarang", slug: "cikarang", city: "Bekasi", address: "Jl. Cikarang Baru Boulevard No. 9", latitude: -6.2617, longitude: 107.1528 },
  { locationId: "locations/demo-013", name: "Suka Shawarma Serpong", slug: "serpong", city: "Tangerang Selatan", address: "Jl. Raya Serpong No. 77", latitude: -6.2891, longitude: 106.6747 },
  { locationId: "locations/demo-014", name: "Suka Shawarma Cibinong", slug: "cibinong", city: "Bogor", address: "Jl. Raya Bogor KM 43", latitude: -6.4817, longitude: 106.8544 },
  { locationId: "locations/demo-015", name: "Suka Shawarma Bintaro", slug: "bintaro", city: "Tangerang Selatan", address: "Jl. Bintaro Utama No. 3A", latitude: -6.2694, longitude: 106.7169 },
  { locationId: "locations/demo-016", name: "Suka Shawarma Cileungsi", slug: "cileungsi", city: "Bogor", address: "Jl. Raya Cileungsi No. 15", latitude: -6.3833, longitude: 106.9694 },
  { locationId: "locations/demo-017", name: "Suka Shawarma Cinere", slug: "cinere", city: "Depok", address: "Jl. Cinere Raya No. 6", latitude: -6.3339, longitude: 106.7833 },
  { locationId: "locations/demo-018", name: "Suka Shawarma Karawang", slug: "karawang", city: "Karawang", address: "Jl. Tuparev No. 22", latitude: -6.3017, longitude: 107.3025 },
];

export function toGoogleLocation(seed: DemoOutletSeed, accountId: string): GoogleLocation {
  return {
    locationId: seed.locationId,
    accountId,
    name: seed.name,
    placeId: `ChIJdemo${seed.slug}`,
    address: seed.address,
    city: seed.city,
    latitude: seed.latitude,
    longitude: seed.longitude,
  };
}

const REVIEWER_NAMES = [
  "Budi S.", "Siti Nurhaliza", "Andi Wijaya", "Dewi Lestari", "Rizky Pratama",
  "Ayu Kartika", "Fajar Nugroho", "Rina Marlina", "Hendra Gunawan", "Nadia Putri",
  "Agus Salim", "Maya Sari", "Dimas Aditya", "Putri Ramadhani", "Yusuf Hakim",
  "Wulan Sari", "Bayu Segara", "Indah Permata", "Reza Firmansyah", "Lestari Wulandari",
  "Arief Rahman", "Citra Dewi", "Doni Setiawan", "Eka Wahyuni", "Fauzan Akbar",
  "Gita Ayu", "Hadi Kusuma", "Intan Permatasari", "Joko Susanto", "Kiki Amelia",
];

interface ReviewTemplate {
  rating: 1 | 2 | 3 | 4 | 5;
  comment: string | null;
  sentiment: Sentiment;
  categories: ReviewCategoryTag[];
  aspects: Partial<Record<ReviewCategoryTag, Sentiment>>;
  summary: string;
  urgency: Urgency;
}

export const DEMO_REVIEW_TEMPLATES: ReviewTemplate[] = [
  { rating: 5, comment: "Dagingnya juara, bumbu meresap banget dan rotinya masih hangat!", sentiment: "positive", categories: ["RASA"], aspects: { RASA: "positive" }, summary: "Pelanggan sangat puas dengan rasa daging dan roti.", urgency: "low" },
  { rating: 5, comment: "Pelayanannya ramah, pesanan cepat datang. Favorit keluarga!", sentiment: "positive", categories: ["PELAYANAN", "KECEPATAN"], aspects: { PELAYANAN: "positive", KECEPATAN: "positive" }, summary: "Pelayanan ramah dan cepat, pelanggan puas.", urgency: "low" },
  { rating: 4, comment: "Enak, porsinya banyak. Cuma tempatnya agak sempit pas jam makan siang.", sentiment: "positive", categories: ["PORSI", "TEMPAT"], aspects: { PORSI: "positive", TEMPAT: "negative" }, summary: "Rasa dan porsi bagus, tempat kurang luas saat ramai.", urgency: "low" },
  { rating: 5, comment: "Sudah langganan dari dulu, konsisten enaknya. Recommended!", sentiment: "positive", categories: ["RASA", "KUALITAS_PRODUK"], aspects: { RASA: "positive", KUALITAS_PRODUK: "positive" }, summary: "Kualitas rasa konsisten, pelanggan setia.", urgency: "low" },
  { rating: 4, comment: "Harga sesuai kantong mahasiswa, rasa oke. Sering ke sini.", sentiment: "positive", categories: ["HARGA", "RASA"], aspects: { HARGA: "positive", RASA: "positive" }, summary: "Harga terjangkau dengan rasa yang memuaskan.", urgency: "low" },
  { rating: 5, comment: "Bersih banget tempatnya, staff-nya sopan. Anak-anak juga suka.", sentiment: "positive", categories: ["KEBERSIHAN", "STAFF"], aspects: { KEBERSIHAN: "positive", STAFF: "positive" }, summary: "Tempat bersih dan staff ramah, cocok untuk keluarga.", urgency: "low" },
  { rating: 5, comment: null, sentiment: "positive", categories: ["LAINNYA"], aspects: {}, summary: "Rating tanpa komentar.", urgency: "low" },
  { rating: 4, comment: null, sentiment: "positive", categories: ["LAINNYA"], aspects: {}, summary: "Rating tanpa komentar.", urgency: "low" },
  { rating: 3, comment: "Rasanya standar aja, gak istimewa tapi gak buruk juga.", sentiment: "neutral", categories: ["RASA"], aspects: { RASA: "neutral" }, summary: "Rasa dinilai biasa saja oleh pelanggan.", urgency: "low" },
  { rating: 3, comment: "Dagingnya enak tapi nunggunya hampir 40 menit.", sentiment: "neutral", categories: ["RASA", "KECEPATAN"], aspects: { RASA: "positive", KECEPATAN: "negative" }, summary: "Rasa enak namun waktu tunggu cukup lama.", urgency: "medium" },
  { rating: 3, comment: "Porsinya lumayan tapi harga naik dikit dari terakhir kesini.", sentiment: "neutral", categories: ["PORSI", "HARGA"], aspects: { PORSI: "neutral", HARGA: "negative" }, summary: "Kenaikan harga dirasakan pelanggan, porsi masih wajar.", urgency: "low" },
  { rating: 3, comment: null, sentiment: "neutral", categories: ["LAINNYA"], aspects: {}, summary: "Rating tanpa komentar.", urgency: "low" },
  { rating: 2, comment: "Pelayanannya lama banget, saya nunggu hampir 30 menit.", sentiment: "negative", categories: ["KECEPATAN", "PELAYANAN"], aspects: { KECEPATAN: "negative", PELAYANAN: "negative" }, summary: "Waktu tunggu sangat lama, pelayanan lambat.", urgency: "medium" },
  { rating: 1, comment: "Pesanan saya salah, minta tanpa bawang malah dikasih banyak bawang.", sentiment: "negative", categories: ["PESANAN_SALAH"], aspects: { PESANAN_SALAH: "negative" }, summary: "Kesalahan pesanan, permintaan khusus diabaikan.", urgency: "high" },
  { rating: 2, comment: "Tempatnya kurang bersih, meja masih kotor pas kita datang.", sentiment: "negative", categories: ["KEBERSIHAN"], aspects: { KEBERSIHAN: "negative" }, summary: "Kebersihan tempat perlu diperhatikan.", urgency: "medium" },
  { rating: 1, comment: "Rasanya beda dari biasanya, kayak buru-buru masaknya. Kecewa.", sentiment: "negative", categories: ["RASA", "KUALITAS_PRODUK"], aspects: { RASA: "negative", KUALITAS_PRODUK: "negative" }, summary: "Kualitas rasa menurun dibanding biasanya.", urgency: "high" },
  { rating: 2, comment: "Staff-nya jutek, kurang ramah waktu saya tanya menu.", sentiment: "negative", categories: ["STAFF"], aspects: { STAFF: "negative" }, summary: "Sikap staff dinilai kurang ramah.", urgency: "medium" },
  { rating: 1, comment: "Harga naik tapi porsi malah berkurang. Kecewa berat.", sentiment: "negative", categories: ["HARGA", "PORSI"], aspects: { HARGA: "negative", PORSI: "negative" }, summary: "Kenaikan harga tidak sebanding dengan porsi.", urgency: "high" },
  { rating: 1, comment: "Delivery-nya telat 1 jam dari estimasi, makanan udah dingin.", sentiment: "negative", categories: ["DELIVERY", "KECEPATAN"], aspects: { DELIVERY: "negative", KECEPATAN: "negative" }, summary: "Keterlambatan pengiriman, makanan tiba dingin.", urgency: "high" },
  { rating: 2, comment: "Antrinya panjang banget, gak ada sistem antrian yang jelas.", sentiment: "negative", categories: ["PELAYANAN", "KECEPATAN"], aspects: { PELAYANAN: "negative", KECEPATAN: "negative" }, summary: "Antrian tidak teratur, waktu tunggu lama.", urgency: "medium" },
  { rating: 1, comment: "Order lewat aplikasi salah kirim ke alamat lain. Sangat mengecewakan.", sentiment: "negative", categories: ["PESANAN_SALAH", "DELIVERY"], aspects: { PESANAN_SALAH: "negative", DELIVERY: "negative" }, summary: "Kesalahan pengiriman pesanan ke alamat yang salah.", urgency: "high" },
  { rating: 2, comment: null, sentiment: "negative", categories: ["LAINNYA"], aspects: {}, summary: "Rating rendah tanpa komentar.", urgency: "medium" },
  { rating: 1, comment: null, sentiment: "negative", categories: ["LAINNYA"], aspects: {}, summary: "Rating rendah tanpa komentar.", urgency: "medium" },
  { rating: 4, comment: "Shawarma-nya juicy, sausnya pas. Parkirnya agak susah aja.", sentiment: "positive", categories: ["RASA", "TEMPAT"], aspects: { RASA: "positive", TEMPAT: "negative" }, summary: "Rasa disukai, akses parkir menjadi kendala kecil.", urgency: "low" },
  { rating: 5, comment: "Best shawarma di daerah sini! Selalu ramai tapi worth it.", sentiment: "positive", categories: ["RASA", "KUALITAS_PRODUK"], aspects: { RASA: "positive", KUALITAS_PRODUK: "positive" }, summary: "Dianggap shawarma terbaik di area tersebut.", urgency: "low" },
];

export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function randomReviewerName(): string {
  return pickRandom(REVIEWER_NAMES);
}
