import { useState } from "react";
import { useNavigate, Form, useLoaderData } from "@remix-run/react";
import { redirect } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { PrismaClient } from "@prisma/client";
import { authenticator } from "~/utils/auth.server";

const prisma = new PrismaClient();

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request);
  if (!user) {
    return redirect("/login");
  }

  const userDetails = await prisma.user.findUnique({
    where: { id: user.id },
    select: { 
      username: true,
      password: true // Cek apakah password null (Google user)
    },
  });

  if (!userDetails) {
    throw new Error("User tidak ditemukan di database.");
  }

  return { 
    user, 
    name: userDetails.username,
    isGoogleUser: userDetails.password === null // Google user tidak memiliki password
  };
};

type LoaderData = {
  name: string;
  isGoogleUser: boolean;
};

const ProfilePage = () => {
  const { name, isGoogleUser } = useLoaderData<LoaderData>();
  const navigate = useNavigate();
  const [showLogoutPopup, setShowLogoutPopup] = useState(false);

  const handleLogout = () => {
    setShowLogoutPopup(true);
  };

  const confirmLogout = () => {
    navigate("/");
  };

  const handleChangePassword = () => {
    if (isGoogleUser) {
      // Tampilkan pesan untuk Google user
      alert("Akun Google tidak dapat mengubah password melalui aplikasi ini. Silakan ubah password melalui pengaturan akun Google Anda.");
      return;
    }
    navigate("/change-password");
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-white">
      <div className="w-full bg-yellow-300 p-6 flex flex-col items-center">
        <button
          className="bg-gray-300 w-14 h-14 rounded-full flex items-center justify-center"
          onClick={() => navigate("/account")}
        >
          <i className="fas fa-user-circle text-6xl text-white"></i>
        </button>
        <button
          className="flex items-center mt-2"
          onClick={() => navigate("/account")}
        >
          <span className="text-xl font-bold">{name}</span>
          {isGoogleUser && (
            <i className="fab fa-google ml-2 text-white bg-blue-500 rounded-full p-1"></i>
          )}
          <i className="fas fa-pencil-alt ml-2 text-black"></i>
        </button>
      </div>
      <div className="w-full flex flex-col items-center space-y-4 mt-16">
        <button
          className="w-11/12 flex items-center justify-between p-4 bg-white rounded-lg shadow-md border border-black"
          onClick={() => navigate("/riwayat-pesanan")}
        >
          <div className="flex items-center">
            <div className="w-8 flex justify-center">
              <i className="fas fa-history text-2xl text-black"></i>
            </div>
            <span className="ml-4 text-lg font-semibold">Pesanan Saya</span>
          </div>
          <div className="w-8 h-8 bg-yellow-300 rounded-full flex items-center justify-center">
            <i className="fas fa-chevron-right text-black"></i>
          </div>
        </button>
        <button
          className="w-11/12 flex items-center justify-between p-4 bg-white rounded-lg shadow-md border border-black"
          onClick={() => navigate("/riwayat-transaksi")}
        >
          <div className="flex items-center">
            <div className="w-8 flex justify-center">
              <i className="fas fa-receipt text-2xl text-black"></i>
            </div>
            <span className="ml-4 text-lg font-semibold">
              Riwayat Transaksi
            </span>
          </div>
          <div className="w-8 h-8 bg-yellow-300 rounded-full flex items-center justify-center">
            <i className="fas fa-chevron-right text-black"></i>
          </div>
        </button>
        <button
          className="w-11/12 flex items-center justify-between p-4 bg-white rounded-lg shadow-md border border-black"
          onClick={() => navigate("/tentangkami")}
        >
          <div className="flex items-center">
            <div className="w-8 flex justify-center">
              <i className="fas fa-question-circle text-2xl text-black"></i>
            </div>
            <span className="ml-4 text-lg font-semibold">Tentang Kami</span>
          </div>
          <div className="w-8 h-8 bg-yellow-300 rounded-full flex items-center justify-center">
            <i className="fas fa-chevron-right text-black"></i>
          </div>
        </button>
        
        {/* Tombol Ganti Password - dengan kondisi untuk Google user */}
        <button
          className={`w-11/12 p-4 rounded-lg shadow-md border font-bold border-black ${
            isGoogleUser 
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
              : 'bg-white text-yellow-300 text-outline hover:bg-gray-50'
          }`}
          onClick={handleChangePassword}
          disabled={isGoogleUser}
        >
          <div className="flex items-center justify-center">
            <span>Ganti Password</span>
            {isGoogleUser && (
              <i className="fas fa-lock ml-2 text-gray-400"></i>
            )}
          </div>
          {isGoogleUser && (
            <div className="text-xs mt-1 text-gray-400">
              Tidak tersedia untuk akun Google
            </div>
          )}
        </button>
        
        <button
          className="w-11/12 p-4 bg-yellow-300 rounded-lg shadow-md border text-black font-bold border-black mb-important"
          onClick={handleLogout}
        >
          Log Out
        </button>
      </div>
      <footer className="bottom-0 w-full bg-yellow-300 p-4 flex justify-around items-center z-10 sticky">
        <div
          className="flex flex-col items-center cursor-pointer"
          role="button"
          tabIndex={0}
          onClick={() => navigate("/")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              navigate("/");
            }
          }}
        >
          <i className="fas fa-home text-2xl text-white"></i>
          <span className="text-white text-sm font-bold">Beranda</span>
        </div>
        <div
          className="flex flex-col items-center cursor-pointer"
          role="button"
          tabIndex={0}
          onClick={() => navigate("/cart")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              navigate("/cart");
            }
          }}
        >
          <i className="fas fa-shopping-cart text-2xl text-white"></i>
          <span className="text-white text-sm font-bold">Keranjang</span>
        </div>
        <div
          className="flex flex-col items-center cursor-pointer"
          role="button"
          tabIndex={0}
          onClick={() => navigate("/profile")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              navigate("/profile");
            }
          }}
        >
          <i className="fas fa-user text-2xl text-white"></i>
          <span className="text-white text-sm font-bold">Saya</span>
        </div>
      </footer>

      {/* Popup Logout */}
      {showLogoutPopup && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white rounded-lg border-2 border-yellow-300 p-8 text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-yellow-300 w-10 h-10 flex items-center justify-center rounded-full">
                <span className="text-2xl font-bold text-black">!</span>
              </div>
            </div>
            <p className="text-lg font-semibold mb-6">
              Apakah yakin ingin log out?
            </p>
            <div className="flex justify-center space-x-4">
              <button
                className="bg-yellow-300 text-black px-6 py-2 rounded font-bold"
                onClick={() => setShowLogoutPopup(false)}
              >
                Tidak
              </button>
              <Form method="post" action="/logout">
                <button
                  className="border border-black px-6 py-2 rounded font-bold text-black"
                  onClick={confirmLogout}
                >
                  Iya
                </button>
              </Form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;