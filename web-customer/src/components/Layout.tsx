import { Outlet } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import OfflineBanner from './OfflineBanner';

export default function Layout() {
  return (
    <>
      <OfflineBanner />
      <Header />
      <main>
        <div className="wrap">
          <Outlet />
        </div>
      </main>
      <Footer />
    </>
  );
}
