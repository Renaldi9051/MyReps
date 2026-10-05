// Tutorial cara pakai: tampil otomatis di Pilih latihan setiap app dibuka sampai pengguna mencentang
// "Jangan tampilkan lagi". Pilihan disimpan per akun di perangkat ini; dari Akun tutorial tetap bisa dibuka.
const KEY = 'myrep:tutorial-hidden';

// Sekali per app dibuka: pindah tab lalu kembali ke Latihan tidak memunculkannya lagi
let shownThisRun = false;

const keyFor = (userId: string) => `${KEY}:${userId}`;

export function getTutorialHidden(userId: string | undefined): boolean {
  if (!userId) return false;
  try {
    return localStorage.getItem(keyFor(userId)) === '1';
  } catch {
    return false;
  }
}

export function setTutorialHidden(userId: string | undefined, hidden: boolean) {
  if (!userId) return;
  try {
    if (hidden) localStorage.setItem(keyFor(userId), '1');
    else localStorage.removeItem(keyFor(userId));
  } catch {
    // localStorage diblokir: pilihan hanya berlaku selama tab terbuka
  }
}

export function shouldAutoShowTutorial(userId: string | undefined): boolean {
  return !shownThisRun && !!userId && !getTutorialHidden(userId);
}

export function markTutorialShown() {
  shownThisRun = true;
}
