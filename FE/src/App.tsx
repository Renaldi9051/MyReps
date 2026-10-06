import { useEffect, useRef, useState } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation, useMatch } from 'react-router';
import { BottomNav } from './components/BottomNav';
import { useTabSwipe, type SwipeNavState } from './components/useTabSwipe';
import { useAuth } from './features/auth/useAuth';
import { useSyncTriggers } from './features/sync/hooks';
import { hideBoot, useBootReady } from './lib/boot';
import { navDirection, type NavDir } from './lib/nav';
import { AkunPage } from './pages/AkunPage';
import { CatatPage } from './pages/CatatPage';
import { KelolaLatihanPage } from './pages/KelolaLatihanPage';
import { LatihanPage } from './pages/LatihanPage';
import { LatihanRiwayatPage } from './pages/LatihanRiwayatPage';
import { LoginPage } from './pages/LoginPage';
import { ProgresPage } from './pages/ProgresPage';
import { RiwayatPage } from './pages/RiwayatPage';
import { TambahLatihanPage } from './pages/TambahLatihanPage';

function Splash() {
  return (
    <div className="splash" aria-label="Memuat">
      <span className="pill-label">MyReps</span>
    </div>
  );
}

// Halaman di balik login. Sinkron hanya berjalan selama user login.
function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <Splash />;
  if (status === 'guest') return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <AppLayout />;
}

// DESIGN §5.2: nav bawah tampil di semua layar kecuali Masuk
function AppLayout() {
  useSyncTriggers();
  // /latihan (start_url ikon) memberi sinyal sendiri setelah datanya siap; halaman lain langsung
  useBootReady(!useMatch('/latihan'));
  const location = useLocation();
  const screenRef = useRef<HTMLDivElement>(null);
  const swipeable = useTabSwipe(screenRef);
  // Arah ganti halaman dihitung sekali tiap path berubah (pola "sesuaikan state saat render"),
  // jadi isi halaman baru langsung masuk dari sisi yang benar (CSS data-nav)
  const [nav, setNav] = useState<{ path: string; dir: NavDir }>({ path: location.pathname, dir: 0 });
  if (nav.path !== location.pathname) setNav({ path: location.pathname, dir: navDirection(nav.path, location.pathname) });
  const swiped = (location.state as Partial<SwipeNavState> | null)?.swipe === true;

  return (
    <div
      ref={screenRef}
      className="screen"
      data-nav={nav.dir === 1 ? 'next' : nav.dir === -1 ? 'prev' : undefined}
      data-swipe={swiped || undefined}
      data-tabs={swipeable || undefined}
    >
      <Outlet />
      <BottomNav />
    </div>
  );
}

function GuestOnly() {
  const { status } = useAuth();
  if (status === 'loading') return <Splash />;
  if (status === 'authed') return <Navigate to="/latihan" replace />;
  return <Outlet />;
}

// DESIGN §7
export function App() {
  const { status } = useAuth();
  // Belum login: layar pembuka memudar ke halaman Masuk begitu status diketahui
  useEffect(() => {
    if (status === 'guest') hideBoot();
  }, [status]);

  return (
    <Routes>
      <Route element={<GuestOnly />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>
      <Route element={<RequireAuth />}>
        <Route path="/latihan" element={<LatihanPage />} />
        <Route path="/latihan/tambah" element={<TambahLatihanPage />} />
        <Route path="/latihan/kelola" element={<KelolaLatihanPage />} />
        <Route path="/latihan/:exerciseId" element={<CatatPage />} />
        <Route path="/riwayat" element={<RiwayatPage />} />
        <Route path="/progres" element={<ProgresPage />} />
        <Route path="/progres/latihan/:exerciseId" element={<LatihanRiwayatPage />} />
        <Route path="/akun" element={<AkunPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/latihan" replace />} />
    </Routes>
  );
}
