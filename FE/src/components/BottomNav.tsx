import { BarChart3, Calendar, Dumbbell, User, type LucideIcon } from 'lucide-react';
import { useLayoutEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router';
import { TAB_PATHS } from '../lib/nav';

const ITEMS: { to: (typeof TAB_PATHS)[number]; label: string; icon: LucideIcon }[] = [
  { to: '/latihan', label: 'Latihan', icon: Dumbbell },
  { to: '/riwayat', label: 'Riwayat', icon: Calendar },
  { to: '/progres', label: 'Progres', icon: BarChart3 },
  { to: '/akun', label: 'Akun', icon: User },
];

// DESIGN §5.2: 4 tab, tab aktif terisi hitam. Isian hitam adalah satu pil di belakang tab
// yang meluncur ke tab aktif, jadi ganti tab terlihat bergerak, bukan berkedip.
export function BottomNav() {
  const { pathname } = useLocation();
  const navRef = useRef<HTMLElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const placed = useRef(false);

  // Ganti tab: pil meluncur (kecuali pertama kali muncul)
  useLayoutEffect(() => {
    if (!navRef.current || !pillRef.current) return;
    placePill(navRef.current, pillRef.current, placed.current);
    placed.current = true;
  }, [pathname]);

  // Lebar layar berubah: pil langsung pindah ke posisi baru, tanpa meluncur
  useLayoutEffect(() => {
    const nav = navRef.current;
    const pill = pillRef.current;
    if (!nav || !pill) return;
    const ro = new ResizeObserver(() => placePill(nav, pill, false));
    ro.observe(nav);
    return () => ro.disconnect();
  }, []);

  return (
    <nav className="bottom-nav" aria-label="Navigasi utama" ref={navRef}>
      <span className="bottom-nav__pill" ref={pillRef} aria-hidden />
      {ITEMS.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'nav-item is-active' : 'nav-item')}>
          <Icon size={22} strokeWidth={1.75} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function placePill(nav: HTMLElement, pill: HTMLElement, animate: boolean) {
  const active = nav.querySelector<HTMLElement>('.nav-item.is-active');
  if (!active) {
    pill.style.opacity = '0';
    return;
  }
  pill.style.transition = animate ? '' : 'none';
  pill.style.opacity = '';
  pill.style.width = `${active.offsetWidth}px`;
  pill.style.height = `${active.offsetHeight}px`;
  pill.style.transform = `translate(${active.offsetLeft}px, ${active.offsetTop}px)`;
}
