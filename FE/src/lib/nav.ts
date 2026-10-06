// Urutan tab nav bawah (DESIGN §5.2), juga urutan saat digeser kiri/kanan
export const TAB_PATHS = ['/latihan', '/riwayat', '/progres', '/akun'] as const;

export type NavDir = 1 | -1 | 0;

// Tab tempat sebuah halaman berada: /latihan/abc tetap milik tab Latihan
function tabOf(path: string): number {
  return TAB_PATHS.findIndex((t) => path === t || path.startsWith(`${t}/`));
}

function depth(path: string): number {
  return path.split('/').filter(Boolean).length;
}

// Arah animasi ganti halaman: 1 = masuk dari kanan (tab di kanan atau halaman lebih dalam),
// -1 = dari kiri (tab di kiri atau kembali ke atas), 0 = tanpa arah
export function navDirection(from: string, to: string): NavDir {
  const a = tabOf(from);
  const b = tabOf(to);
  if (a < 0 || b < 0) return 0;
  if (a !== b) return b > a ? 1 : -1;
  const da = depth(from);
  const db = depth(to);
  return db > da ? 1 : db < da ? -1 : 0;
}
