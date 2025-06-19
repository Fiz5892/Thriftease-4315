import { useState, useEffect } from "react";
import { PrismaClient } from '@prisma/client';
import { Form, json, redirect, useActionData, useNavigate } from '@remix-run/react';
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { authenticator } from '~/utils/auth.server';
import bcrypt from 'bcryptjs';
import { sendOTP } from '~/utils/jwt.server';

const prisma = new PrismaClient();

// Loader untuk redirect jika user sudah login
export async function loader({ request }: LoaderFunctionArgs) {
  const user = await authenticator.isAuthenticated(request);
  if (user) return redirect('/');
  return null;
}

// Action untuk menangani register
export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();

  const email = formData.get("email") as string;
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;
  const fullName = formData.get("full_name") as string;
  const phoneNumber = formData.get("phone_number") as string;
  const province = formData.get("province") as string;
  const city = formData.get("city") as string;
  const district = formData.get("district") as string;
  const postalCode = formData.get("postal_code") as string;
  const address = formData.get("address") as string;

  // Validasi data form
  if (!username || !email) {
    return json({
      error: "Username dan Email wajib diisi.",
      data: { username, email, fullName, phoneNumber, province, city, district, postalCode, address }
    }, { status: 400 });
  }

  if (username.length < 5) {
    return json({
      error: "Username harus memiliki panjang minimal 5 karakter.",
      data: { email, fullName, phoneNumber, province, city, district, postalCode, address }
    }, { status: 400 });
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    return json({
      error: "Format email yang dimasukkan tidak valid.",
      data: { username, fullName, phoneNumber, province, city, district, postalCode, address }
    }, { status: 400 });
  }

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email },
        { username },
      ],
    },
  });

  if (existingUser) {
    const errorMessage = existingUser.email === email
      ? "Email sudah terdaftar, silakan gunakan email lain."
      : "Username sudah digunakan, silakan pilih username lain.";

    return json({
      error: errorMessage,
      data: { username, email, fullName, phoneNumber, province, city, district, postalCode, address }
    }, { status: 400 });
  }

  const phonePattern = /^08\d{8,12}$/;
  if (!phonePattern.test(phoneNumber)) {
    return json({
      error: "Nomor telepon harus diawali dengan '08' dan panjangnya antara 10-13 digit.",
      data: { username, email, fullName, province, city, district, postalCode, address }
    }, { status: 400 });
  }

  if (!fullName || fullName.trim().length === 0) {
    return json({
      error: "Nama lengkap wajib diisi.",
      data: { username, email, phoneNumber, province, city, district, postalCode, address }
    }, { status: 400 });
  }

  if (!province || !city || !district) {
    return json({
      error: "Provinsi, Kota, dan Kecamatan wajib dipilih.",
      data: { username, email, fullName, phoneNumber, postalCode, address }
    }, { status: 400 });
  }

  const postalCodePattern = /^\d{5}$/;
  if (!postalCodePattern.test(postalCode)) {
    return json({
      error: "Kode pos harus terdiri dari 5 angka.",
      data: { username, email, fullName, phoneNumber, province, city, district, address }
    }, { status: 400 });
  }

  if (!password) {
    return json({
      error: "Password wajib diisi.",
      data: { username, email, fullName, phoneNumber, province, city, district, postalCode, address }
    }, { status: 400 });
  }

  if (password.length < 8) {
    return json({
      error: "Password harus memiliki minimal 8 karakter.",
      data: { username, email, fullName, phoneNumber, province, city, district, postalCode, address }
    }, { status: 400 });
  }

  const confirmPassword = formData.get("confirmPassword") as string;
  if (password !== confirmPassword) {
    return json({
      error: "Password dan konfirmasi password harus cocok.",
      data: { username, email, fullName, phoneNumber, province, city, district, postalCode, address }
    }, { status: 400 });
  }

  try {
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Menyimpan pengguna baru ke database
    await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        fullName,
        phoneNumber,
        role: "USER",
        isVerified: false,
        province,
        city,
        district,
        postalCode,
        address,
      },
    });

    try {
      // Kirim OTP setelah pengguna berhasil terdaftar
      const { token, expiresIn } = await sendOTP(email);

      // Redirect ke halaman verifikasi OTP dengan token dan email di query string
      return redirect(`/verify-otp?token=${token}&email=${encodeURIComponent(email)}&expiresIn=${expiresIn}`);
    } catch (error) {
      console.error("Error saat mengirim OTP:", error);

      // Pastikan pesan error yang dikembalikan tidak membocorkan detail teknis
      return json({
        error: "Terjadi kesalahan saat mengirim OTP. Silakan coba lagi nanti.",
        data: { username, email, fullName, phoneNumber, province, city, district, postalCode, address },
      }, { status: 500 });
    }

    // return redirect('/');

  } catch (error) {
    console.error('Error saat proses registrasi:', error);
    return json({ error: "Terjadi kesalahan saat proses registrasi. Silakan coba lagi nanti." }, { status: 500 });
  }
};

const SignupPage = () => {
  const actionData = useActionData() as { error?: string } | undefined;
  const errorMessage = actionData?.error; // Ambil pesan error dari `action`

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  type Region = { id: string; name: string };

  const [provinces, setProvinces] = useState<Region[]>([]);
  const [cities, setCities] = useState<Region[]>([]);
  const [subdistricts, setSubdistricts] = useState<Region[]>([]);
  const [address, setAddress] = useState('');
  const [addressError, setAddressError] = useState('');

  const [formSubmitted, setFormSubmitted] = useState(false);
  const [showErrorPopup, setShowErrorPopup] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    fetchProvinces();
  }, []);

  useEffect(() => {
    if (formSubmitted && errorMessage) {
      setShowErrorPopup(true);
      setFormSubmitted(false); // Reset `formSubmitted` setelah pop-up muncul
    }
  }, [formSubmitted, errorMessage]);

  const fetchProvinces = async () => {
    const response = await fetch('/api?type=provinces');
    const data = await response.json();
    setProvinces(data);
  };

  const fetchCities = async (provinceId: string) => {
    const response = await fetch(`/api?type=cities&province_id=${provinceId}`);
    const data = await response.json();
    setCities(data);
  };

  const fetchSubdistricts = async (cityId: string) => {
    const response = await fetch(`/api?type=subdistricts&city_id=${cityId}`);
    const data = await response.json();
    setSubdistricts(data);
  };

  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Izinkan hanya angka dengan regex
    if (/^\d*$/.test(value)) {
      setPhoneNumber(value); // Update state jika valid
    }
  };

  const handlePostalCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Izinkan hanya angka
    if (/^\d*$/.test(value)) {
      setPostalCode(value); // Update state jika valid
    }
  };

  const handleAddressChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setAddress(value); // Perbarui state terlebih dahulu

    // Validasi panjang alamat
    if (value.trim().length < 10) {
      setAddressError("Alamat harus memiliki minimal 10 karakter.");
    } else {
      setAddressError(""); // Hapus error jika valid
    }

    // Atur tinggi textarea sesuai konten
    const element = e.target;
    element.style.height = "auto"; // Reset tinggi
    element.style.height = `${element.scrollHeight}px`; // Sesuaikan tinggi
  };

  const togglePasswordVisibility = () => setShowPassword(!showPassword);
  const toggleConfirmPasswordVisibility = () => setShowConfirmPassword(!showConfirmPassword);

  return (
    <div className="bg-white flex items-center justify-center min-h-screen relative">
      <div className="w-full max-w-4xl p-8 md:p-10 lg:p-12">
        <div className="flex justify-center mb-6">
          <i className="fas fa-user-circle text-6xl text-gray-400"></i>
        </div>
        <h1 className="text-3xl font-bold text-center mb-8">Sign Up Account</h1>
        <Form method="post" action="/register" onSubmit={() => setFormSubmitted(true)}>
          <div className="flex flex-col md:flex-row md:space-x-6 mb-4 md:mb-6">
            {/*username*/}
            <div className="w-full md:w-1/2">
              <label htmlFor="username" className="block text-sm font-medium mb-2">Username</label>
              <input
                id="username"
                type="text"
                name="username"
                className="w-full border border-gray-400 rounded p-3"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            {/*email*/}
            <div className="w-full md:w-1/2">
              <label htmlFor="email" className="block text-sm font-medium mb-2">Email</label>
              <input
                id="email"
                type="email"
                name="email"
                className="w-full border border-gray-400 rounded p-3"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
          {/*no hp*/}
          <div className="flex flex-col md:flex-row md:space-x-6 mb-4 md:mb-6">
            <div className="w-full md:w-1/2">
              <label htmlFor="phone_number" className="block text-sm font-medium mb-2">No. Handphone</label>
              <input
                id="phone_number"
                type="text"
                name="phone_number"
                className="w-full border border-gray-400 rounded p-3"
                value={phoneNumber}
                onChange={handlePhoneNumberChange}
              />
            </div>
            {/*nama lengkap*/}
            <div className="w-full md:w-1/2">
              <label htmlFor="full_name" className="block text-sm font-medium mb-2">Nama Lengkap</label>
              <input
                id="full_name"
                type="text"
                name="full_name"
                className="w-full border border-gray-400 rounded p-3"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
          </div>

          {/* Provinsi */}
          <div className="flex flex-col md:flex-row md:space-x-6 mb-4 md:mb-6">
            <div className="w-full md:w-1/2">
              <label htmlFor="province" className="block text-sm font-medium mb-2">Provinsi</label>
              <select
                id="province"
                name="province"
                className="w-full border border-gray-400 rounded p-3"
                value={province}
                onChange={(e) => {
                  setProvince(e.target.value);
                  fetchCities(e.target.value);
                }}
              >
                <option value="">Pilih Provinsi</option>
                {provinces.map((province) => (
                  <option key={province.id} value={province.id}>
                    {province.name}
                  </option>
                ))}
              </select>
            </div>
            {/* Kota */}
            <div className="w-full md:w-1/2">
              <label htmlFor="city" className="block text-sm font-medium mb-2">Kota</label>
              <select
                id="city"
                name="city"
                className="w-full border border-gray-400 rounded p-3"
                value={city}
                onChange={(e) => {
                  setCity(e.target.value);
                  fetchSubdistricts(e.target.value);
                }}
                disabled={!province}
              >
                <option value="">Pilih Kota</option>
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {/* Kecamatan */}
          <div className="flex flex-col md:flex-row md:space-x-6 mb-4 md:mb-6">
            <div className="w-full md:w-1/2">
              <label htmlFor="district" className="block text-sm font-medium mb-2">Kecamatan</label>
              <select
                id="district"
                name="district"
                className="w-full border border-gray-400 rounded p-3"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                disabled={!city}
              >
                <option value="">Pilih Kecamatan</option>
                {subdistricts.map((subdistrict) => (
                  <option key={subdistrict.id} value={subdistrict.id}>
                    {subdistrict.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-full md:w-1/2">
              <label htmlFor="postal_code" className="block text-sm font-medium mb-2">Kode Pos</label>
              <input
                id="postal_code"
                type="text"
                name="postal_code"
                className="w-full border border-gray-400 rounded p-3"
                value={postalCode}
                onChange={handlePostalCodeChange}
                maxLength={5}
              />
            </div>
          </div>
          {/*alamat*/}
          <div className="mb-4 md:mb-6">
            <label htmlFor="address" className="block text-sm font-medium mb-2">Detail Alamat</label>
            <textarea
              id="address"
              className="w-full border border-gray-400 rounded p-3"
              name="address"
              rows={1}
              style={{ overflow: "hidden " }}
              placeholder="Nama Jalan, No. Rumah, RT., RW., dll"
              value={address}
              onChange={handleAddressChange}
            ></textarea>
            {addressError && <p className="text-red-500 text-sm">{addressError}</p>}
          </div>

          {/* Password dan Konfirmasi Password */}
          <div className="flex flex-col md:flex-row md:space-x-6 mb-4 md:mb-6">
            <div className="w-full md:w-1/2 relative">
              <label htmlFor="password" className="block text-sm font-medium mb-2">Password</label>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                name="password"
                className="w-full border border-gray-400 rounded p-3"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <i
                className={`fas ${showPassword ? "fa-eye-slash" : "fa-eye"} absolute right-3 top-1/2 transform -translate-y-1/2 cursor-pointer text-gray-400 mt-4`}
                onClick={togglePasswordVisibility}
                tabIndex={0}
                role="button"
                aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    togglePasswordVisibility();
                  }
                }}
              ></i>
            </div>
            <div className="w-full md:w-1/2 relative">
              <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2">Confirm Password</label>
              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                className="w-full border border-gray-400 rounded p-3"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <i
                className={`fas ${showConfirmPassword ? "fa-eye-slash" : "fa-eye"} absolute right-3 top-1/2 transform -translate-y-1/2 cursor-pointer text-gray-400 mt-4`}
                onClick={toggleConfirmPasswordVisibility}
                tabIndex={0}
                role="button"
                aria-label={showConfirmPassword ? "Sembunyikan konfirmasi password" : "Tampilkan konfirmasi password"}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleConfirmPasswordVisibility();
                  }
                }}
              ></i>
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-yellow-300 text-white font-bold py-3 rounded"
          >
            Daftar
          </button>
        </Form>

        <div className="text-center mt-6">
          <p className="text-sm">
            Sudah punya akun?
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="text-yellow-300 font-bold ml-1 underline"
              tabIndex={0}
              aria-label="Login"
            >
              Login
            </button>
          </p>
        </div>
        <div className="text-center mt-6">
          <p className="text-sm text-gray-500">Copyright © 2024 ThriftEase</p>
        </div>
      </div>

      {/* Pop-up Error */}
      {showErrorPopup && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white border-2 border-red-600 p-6 rounded-lg w-80 text-center">
            <div className="text-red-600 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-red-600 mb-2">Daftar Gagal</h2>
            <p className="text-gray-600">{errorMessage || 'Pastikan semua data sudah diisi dengan benar.'}</p>
            <button
              className="mt-4 bg-red-600 text-white px-4 py-2 rounded"
              onClick={() => setShowErrorPopup(false)}
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SignupPage;