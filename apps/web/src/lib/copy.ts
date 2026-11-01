// User-facing Indonesian copy, kept in one place so wording changes don't touch components.

export const APP_NAME = "Chat";

export const ERROR_TEXT: Record<string, string> = {
  not_found: "Percakapan tidak ditemukan.",
  busy: "Masih menunggu balasan sebelumnya. Tunggu sebentar.",
  quota_exceeded: "Batas token tercapai.",
  no_api_key: "Layanan belum dikonfigurasi. Hubungi admin.",
  refused: "Model menolak permintaan ini. Coba ubah pertanyaanmu.",
  upstream_auth: "API key layanan tidak valid atau dinonaktifkan. Hubungi admin.",
  upstream_credits: "Kredit OpenRouter habis. Hubungi admin.",
  model_unavailable: "Model yang dipilih admin tidak tersedia. Hubungi admin.",
  upstream_unavailable: "Model sedang kelebihan beban di penyedianya. Coba kirim ulang sebentar lagi.",
  upstream_rate_limited: "Layanan sedang sibuk. Coba lagi sebentar lagi.",
  upstream_error: "Terjadi kesalahan saat menghubungi model. Coba lagi.",
  network: "Koneksi terputus. Periksa jaringan lalu coba lagi.",
  internal_error: "Terjadi kesalahan di server.",
  model_not_free: "Model default sudah tidak gratis di OpenRouter. Hubungi admin.",
  model_not_allowed: "Model itu tidak tersedia untukmu.",
  catalog_unavailable: "Daftar model OpenRouter sedang tidak bisa diambil. Coba lagi sebentar lagi.",
  cannot_change_own_access: "Kamu tidak bisa mengubah role atau status akunmu sendiri.",
};

/** Maps an error code from the API to display text. */
export function errorText(code: string | undefined): string {
  return (code && ERROR_TEXT[code]) || ERROR_TEXT.internal_error!;
}

export const QUOTA_SCOPE_TEXT = { session: "sesi 5 jam", weekly: "mingguan" } as const;

export const STATUS_TEXT = { pending: "Menunggu", approved: "Disetujui", rejected: "Ditolak" } as const;

export const COMPOSER_PLACEHOLDER = "Tulis pesan…";
export const NEW_CHAT_PLACEHOLDER = "Ada yang bisa dibantu hari ini?";

export const USAGE_TEXT = {
  title: "Pemakaian token",
  adminTitle: "Pemakaian semua pengguna",
  daily: "Token harian",
  byModel: "Per model",
  topUsers: "Pengguna teratas",
  quota: "Batas pemakaian",
  empty: "Belum ada pemakaian pada rentang ini.",
  loadFailed: "Gagal memuat data pemakaian.",
  requests: "permintaan",
  periods: { today: "Hari ini", week: "Minggu ini", month: "Bulan ini" },
} as const;

export const MODEL_TEXT = {
  pickerLabel: "Model",
  defaultSuffix: "default",
  image: "gambar",
  fellBack: "Model pilihanmu sudah tidak tersedia gratis, jadi dijawab oleh model default.",
  adminTitle: "Model gratis",
  adminHint: "Diambil langsung dari OpenRouter (hanya yang gratis). Centang model yang boleh dipilih user; model default selalu tersedia.",
  allowColumn: "Boleh dipilih",
  defaultColumn: "Default",
  saved: "Pilihan model disimpan. Berlaku mulai pesan berikutnya.",
} as const;
