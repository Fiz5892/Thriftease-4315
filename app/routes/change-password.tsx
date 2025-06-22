import { useState } from "react";
import image from "/public/foto/rb_8863%201.png";
import { ActionFunction, LoaderFunction, redirect } from "@remix-run/node";
import { authenticator } from "~/utils/auth.server";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { useNavigate, useLoaderData } from "@remix-run/react";

const prisma = new PrismaClient();

export const loader: LoaderFunction = async ({ request }) => {
  const user = await authenticator.isAuthenticated(request);
  if (!user) {
    return redirect("/login");
  }

  // Ambil data user untuk mengecek apakah user login dengan Google
  const userData = await prisma.user.findUnique({
    where: { id: user.id },
    select: { 
      password: true
    },
  });

  return { 
    user,
    userData,
    isGoogleUser: userData?.password === null // Google user tidak memiliki password
  };
};

export const action: ActionFunction = async ({ request }) => {
  const user = await authenticator.isAuthenticated(request);
  if (!user) {
    return redirect("/login");
  }

  // Cek apakah user adalah Google user
  const userData = await prisma.user.findUnique({
    where: { id: user.id },
    select: { 
      password: true
    },
  });

  if (userData?.password === null) {
    return new Response(JSON.stringify({ error: "Pengguna Google tidak dapat mengubah password." }), {
      status: 403,
    });
  }

  const formData = await request.formData();
  const oldPassword = formData.get("oldPassword");
  const newPassword = formData.get("newPassword");

  if (
    !oldPassword ||
    !newPassword ||
    typeof oldPassword !== "string" ||
    typeof newPassword !== "string"
  ) {
    return new Response(JSON.stringify({ error: "Semua field harus diisi." }), {
      status: 400,
    });
  }

  if (!userData || !userData.password || !(await bcrypt.compare(oldPassword, userData.password))) {
    return new Response(JSON.stringify({ error: "Password lama salah." }), {
      status: 400,
    });
  }

  if (oldPassword === newPassword) {
    return new Response(JSON.stringify({ error: "Password baru tidak boleh sama dengan password lama." }), {
      status: 400,
    });
  }

  const hashedNewPassword = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedNewPassword },
  });

  return redirect("/success-changepassword");
};

const ChangePasswordPage = () => {
  const { isGoogleUser } = useLoaderData<{ isGoogleUser: boolean }>();
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  const toggleOldPasswordVisibility = () => {
    setShowOldPassword((prev) => !prev);
  };

  const toggleNewPasswordVisibility = () => {
    setShowNewPassword((prev) => !prev);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (isGoogleUser) {
      setErrorMessage("Akun Google tidak dapat mengubah password. Silakan ubah password melalui Google Account.");
      return;
    }

    const formData = new FormData(e.target as HTMLFormElement);

    try {
      const response = await fetch(window.location.pathname, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        navigate("/success-changepassword");
      } else {
        const data = await response.json();
        setErrorMessage(data.error);
      }
    } catch (error) {
      setErrorMessage("Terjadi kesalahan saat memproses permintaan Anda.");
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <header className="relative flex items-center justify-between border-b pb-2 lg:pb-4 mb-4 lg:mb-6 w-full px-4 lg:px-8 bg-white pt-4">
        <button
          onClick={() => navigate(-1)}
          className="w-8 h-8 lg:w-10 lg:h-10 bg-yellow-300 rounded-full flex items-center justify-center"
        >
          <i className="fas fa-arrow-left"></i>
        </button>
        <h1 className="absolute left-1/2 transform -translate-x-1/2 text-xl lg:text-2xl font-bold">
          Ganti Password
        </h1>
      </header>
      
      <div className="flex items-center justify-center mt-16 bg-white">
        <div className="w-full max-w-xs mx-auto">
          <img src={image} alt="Illustration" className="mx-auto mb-4" />
          
          {isGoogleUser ? (
            // Tampilan untuk Google user
            <div className="text-center">
              <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-3 rounded mb-6">
                <div className="flex items-center justify-center mb-2">
                  <i className="fab fa-google text-2xl mr-2"></i>
                  <span className="font-semibold">Akun Google</span>
                </div>
                <p className="text-sm">
                  Anda login menggunakan akun Google. Password tidak dapat diubah melalui aplikasi ini.
                </p>
              </div>
              <p className="text-gray-600 mb-6">
                Untuk mengubah password, silakan kunjungi pengaturan akun Google Anda.
              </p>
              <button
                onClick={() => window.open('https://myaccount.google.com/security', '_blank')}
                className="w-full p-3 bg-blue-500 text-white font-bold rounded shadow-md hover:bg-blue-600 mb-4"
              >
                Buka Pengaturan Google
              </button>
              <button
                onClick={() => navigate(-1)}
                className="w-full p-3 bg-gray-300 text-gray-700 font-bold rounded shadow-md hover:bg-gray-400"
              >
                Kembali
              </button>
            </div>
          ) : (
            // Tampilan normal untuk user biasa
            <div>
              <p className="text-center text-gray-700 mb-8">
                Masukkan password lama dan password baru untuk mengganti password Anda
              </p>
              {errorMessage && (
                <p className="text-red-500 text-center mb-4">{errorMessage}</p>
              )}
              <form method="post" className="space-y-6" onSubmit={handleSubmit}>
                <div>
                  <label
                    className="block text-sm font-bold mb-2"
                    htmlFor="oldPassword"
                  >
                    Password Lama
                  </label>
                  <div className="relative">
                    <input
                      name="oldPassword"
                      className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      type={showOldPassword ? "text" : "password"}
                      id="oldPassword"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 flex items-center pr-3 cursor-pointer bg-transparent border-none focus:outline-none"
                      onClick={toggleOldPasswordVisibility}
                      aria-label={showOldPassword ? "Sembunyikan password lama" : "Tampilkan password lama"}
                    >
                      <i
                        className={`fas ${
                          showOldPassword ? "fa-eye-slash" : "fa-eye"
                        }`}
                      ></i>
                    </button>
                  </div>
                </div>
                <div>
                  <label
                    className="block text-sm font-bold mb-2"
                    htmlFor="newPassword"
                  >
                    Password Baru
                  </label>
                  <div className="relative">
                    <input
                      name="newPassword"
                      className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      type={showNewPassword ? "text" : "password"}
                      id="newPassword"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 flex items-center pr-3 cursor-pointer bg-transparent border-none focus:outline-none"
                      onClick={toggleNewPasswordVisibility}
                      aria-label={showNewPassword ? "Sembunyikan password baru" : "Tampilkan password baru"}
                    >
                      <i
                        className={`fas ${
                          showNewPassword ? "fa-eye-slash" : "fa-eye"
                        }`}
                      ></i>
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full p-3 bg-yellow-300 text-black font-bold rounded shadow-md hover:bg-yellow-400"
                >
                  Ganti Password
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChangePasswordPage;