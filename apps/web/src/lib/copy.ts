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
