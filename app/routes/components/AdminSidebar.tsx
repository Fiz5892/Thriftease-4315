// Import Link component dari Remix untuk navigasi antar halaman
// Link component memungkinkan navigasi client-side tanpa full page reload
import { Link } from "@remix-run/react";
import { useState } from "react";
import {
  HomeIcon,
  CubeIcon,
  ShoppingCartIcon,
  UserGroupIcon,
  ChartBarIcon,
  Cog6ToothIcon as CogIcon
} from "@heroicons/react/24/outline";

// AdminSidebar: Komponen untuk menampilkan sidebar navigasi khusus admin
// Menampilkan menu-menu utama untuk pengelolaan sistem
export function AdminSidebar() {
  const [isOpen, setIsOpen] = useState(true);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  }
  return (
    <div>
      {/* Tombol hamburger */}
      <button
        className="fixed top-0 left-0 z-10 p-4 text-gray-500 hover:text-gray-900"
        onClick={handleToggle}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-10 w-10"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
        TOMBOL
      </button>

      {/* Sidebar */}
      <nav
        className={`w-64 bg-gray-800 text-white fixed top-0 left-0 h-screen transition-all duration-500 ${isOpen ? 'block' : 'hidden'
          }`}
      >
        {/* Header sidebar */}
        {/* p-4: padding 1rem (16px) di semua sisi */}
        <div className="p-4">
          {/* Judul sidebar */}
          {/* text-xl: ukuran font lebih besar */}
          {/* font-bold: weight font tebal */}
          <h1 className="text-xl font-bold">ThriftEase Admin</h1>
        </div>

        {/* Container menu navigasi */}
        {/* mt-4: margin top 1rem (16px) */}
        <div className="mt-4">
          {/* Menu Dashboard */}
          {/* HomeIcon: icon rumah dari library lucide-react */}
          <SidebarLink to="/admin" icon={HomeIcon}>
            Dashboard
          </SidebarLink>

          {/* Menu Produk */}
          {/* CubeIcon: icon kubus untuk representasi produk */}
          <SidebarLink to="/admin/products" icon={CubeIcon}>
            Produk
          </SidebarLink>

          {/* Menu Pesanan */}
          {/* ShoppingCartIcon: icon keranjang belanja */}
          <SidebarLink to="/admin/orders" icon={ShoppingCartIcon}>
            Pesanan
          </SidebarLink>

          {/* Menu Pelanggan */}
          {/* UserGroupIcon: icon grup user */}
          <SidebarLink to="/admin/customers" icon={UserGroupIcon}>
            Pelanggan
          </SidebarLink>

          {/* Menu Laporan */}
          {/* ChartBarIcon: icon grafik bar */}
          <SidebarLink to="/admin/reports" icon={ChartBarIcon}>
            Laporan
          </SidebarLink>

          {/* Menu Pengaturan */}
          {/* CogIcon: icon gear untuk settings */}
          <SidebarLink to="/admin/settings" icon={CogIcon}>
            Pengaturan
          </SidebarLink>
        </div>
      </nav>
    </div>
  );
}

// Komponen SidebarLink yang digunakan (perlu dibuat terpisah)
type SidebarLinkProps = {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
};

function SidebarLink({ to, icon: Icon, children }: SidebarLinkProps) {
  return (
    <Link
      to={to}
      className="flex items-center px-4 py-2 text-gray-300 hover:bg-gray-700 hover:text-white"
    >
      <Icon style={{ width: "60px", height: "60px" }} />
      <span>{children}</span>
    </Link>
  );
}