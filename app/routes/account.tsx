import { json, LoaderFunction, redirect, ActionFunction } from "@remix-run/node";
import { useEffect, useState } from "react";
import { useNavigate, useLoaderData, Form, useNavigation, useActionData } from "@remix-run/react";
import { authenticator } from "../utils/auth.server";
import { PrismaClient } from "@prisma/client";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  SpinningLoader,
  LoadingOverlay,
  DoubleRingSpinner,
} from "../routes/components/SpinningLoader";

const prisma = new PrismaClient();

// Type definitions
interface User {
  id: string;
  username?: string;
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  address?: string;
  province?: string;
  city?: string;
  district?: string;
  postalCode?: string;
}

interface LoaderData {
  user: User;
}

interface ActionData {
  success?: boolean;
  error?: string;
  message?: string;
}

interface Province {
  id: string;
  name: string;
}

interface City {
  id: string;
  name: string;
}

interface Subdistrict {
  id: string;
  name: string;
}

export const loader: LoaderFunction = async ({ request }) => {
  const user = await authenticator.isAuthenticated(request);
  if (!user) {
    return redirect("/login");
  }

  const userData = await prisma.user.findUnique({
    where: { id: user.id },
  });

  if (!userData) {
    throw json({ error: "User not found." }, { status: 404 });
  }

  return json({ user: userData });
};

export const action: ActionFunction = async ({ request }) => {
  try {
    const user = await authenticator.isAuthenticated(request);
    if (!user) {
      return json({ error: "Unauthorized", success: false }, { status: 401 });
    }

    const formData = await request.formData();
    const userId = formData.get("id") as string;
    const username = formData.get("username") as string;
    const phone = formData.get("phone") as string;
    const name = formData.get("name") as string;
    const address = formData.get("address") as string;
    const province = formData.get("province") as string;
    const city = formData.get("city") as string;
    const district = formData.get("district") as string;
    const postalCode = formData.get("postalCode") as string;

    // Validate required fields
    if (!userId) {
      return json({ error: "User ID is required", success: false }, { status: 400 });
    }

    // Update user in database (email is excluded from updates)
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        username: username || undefined,
        phoneNumber: phone || undefined,
        fullName: name || undefined,
        address: address || undefined,
        province: province || undefined,
        city: city || undefined,
        district: district || undefined,
        postalCode: postalCode || undefined,
      },
    });

    console.log("User updated successfully:", updatedUser.id);

    return json({ 
      success: true, 
      message: "Data berhasil disimpan!",
      user: updatedUser 
    });

  } catch (error) {
    console.error("Action error:", error);
    return json({ 
      error: "Gagal menyimpan data ke database", 
      success: false 
    }, { status: 500 });
  }
};

const KelolaAkunPage = () => {
  const { user } = useLoaderData<LoaderData>();
  const actionData = useActionData<ActionData>();
  const navigation = useNavigation();
  const navigate = useNavigate();

  const [username, setUsername] = useState(user.username || "");
  const [name, setName] = useState(user.fullName || "");
  const [email] = useState(user.email || "");
  const [phone, setPhone] = useState(user.phoneNumber || "");
  const [address, setAddress] = useState(user.address || "");
  const [province, setProvince] = useState(user.province || "");
  const [city, setCity] = useState(user.city || "");
  const [district, setDistrict] = useState(user.district || "");
  const [postalCode, setPostalCode] = useState(user.postalCode || "");
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [subdistricts, setSubdistricts] = useState<Subdistrict[]>([]);
  
  // Loading states
  const [isLoadingProvinces, setIsLoadingProvinces] = useState(false);
  const [isLoadingCities, setIsLoadingCities] = useState(false);
  const [isLoadingSubdistricts, setIsLoadingSubdistricts] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [shouldNavigate, setShouldNavigate] = useState(false);

  // Check if page is loading or submitting
  const isPageLoading = navigation.state === "loading";
  const isSubmitting = navigation.state === "submitting";

  // Handle action data (success/error from server)
  useEffect(() => {
    if (actionData && navigation.state === "idle") {
      if (actionData.success) {
        // Show success toast immediately
        toast.success(actionData.message || "Data berhasil disimpan!", {
          position: "top-center",
          autoClose: 2000,
          hideProgressBar: true,
          closeOnClick: false,
          pauseOnHover: false,
          draggable: false,
          progress: undefined,
          theme: "colored",
        });

        // Set flag to navigate after showing toast
        setShouldNavigate(true);
        
      } else {
        toast.error(actionData.error || "Gagal menyimpan data!", {
          position: "top-center",
          autoClose: 3000,
          hideProgressBar: true,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "colored",
        });
      }
    }
  }, [actionData, navigation.state]);

  // Handle navigation after toast
  useEffect(() => {
    if (shouldNavigate) {
      const timer = setTimeout(() => {
        navigate(-1);
      }, 2200);

      return () => clearTimeout(timer);
    }
  }, [shouldNavigate, navigate]);

  useEffect(() => {
    const initializeData = async () => {
      setIsInitialLoading(true);
      try {
        await fetchProvinces();
        
        if (user.province) {
          setProvince(user.province);
          await fetchCities(user.province);
          
          if (user.city) {
            setCity(user.city);
            await fetchSubdistricts(user.city);
            
            if (user.district) {
              setDistrict(user.district);
            }
          }
        }
      } catch (error) {
        console.error("Error initializing data:", error);
        toast.error("Gagal memuat data lokasi!", {
          position: "top-center",
          autoClose: 3000,
          hideProgressBar: true,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "colored",
        });
      } finally {
        setIsInitialLoading(false);
      }
    };

    initializeData();
  }, [user.province, user.city, user.district]);

  const fetchProvinces = async () => {
    setIsLoadingProvinces(true);
    try {
      const response = await fetch("/api?type=provinces");
      const data = await response.json();
      setProvinces(data);
    } catch (error) {
      console.error("Error fetching provinces:", error);
      throw error;
    } finally {
      setIsLoadingProvinces(false);
    }
  };

  const fetchCities = async (provinceId: string) => {
    setIsLoadingCities(true);
    try {
      const response = await fetch(`/api?type=cities&province_id=${provinceId}`);
      const data = await response.json();
      setCities(data);
    } catch (error) {
      console.error("Error fetching cities:", error);
      throw error;
    } finally {
      setIsLoadingCities(false);
    }
  };

  const fetchSubdistricts = async (cityId: string) => {
    setIsLoadingSubdistricts(true);
    try {
      const response = await fetch(`/api?type=subdistricts&city_id=${cityId}`);
      const data = await response.json();
      setSubdistricts(data);
    } catch (error) {
      console.error("Error fetching subdistricts:", error);
      throw error;
    } finally {
      setIsLoadingSubdistricts(false);
    }
  };

  const handleProvinceChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedProvince = e.target.value;
    setProvince(selectedProvince);
    setCity("");
    setDistrict("");
    setCities([]);
    setSubdistricts([]);
    
    if (selectedProvince) {
      try {
        await fetchCities(selectedProvince);
      } catch (error) {
        toast.error("Gagal memuat data kota!", {
          position: "top-center",
          autoClose: 3000,
          hideProgressBar: true,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "colored",
        });
      }
    }
  };

  const handleCityChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedCity = e.target.value;
    setCity(selectedCity);
    setDistrict("");
    setSubdistricts([]);
    
    if (selectedCity) {
      try {
        await fetchSubdistricts(selectedCity);
      } catch (error) {
        toast.error("Gagal memuat data kecamatan!", {
          position: "top-center",
          autoClose: 3000,
          hideProgressBar: true,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "colored",
        });
      }
    }
  };

  // Show loading overlay during initial data loading
  if (isInitialLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-100">
        <LoadingOverlay
          isVisible={true}
          text="Memuat data akun..."
          blur={true}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      <ToastContainer />

      {/* Loading Overlay untuk page loading dan submitting */}
      <LoadingOverlay
        isVisible={isPageLoading || isSubmitting}
        text={isSubmitting ? "Menyimpan data..." : "Memuat halaman..."}
        blur={true}
      />

      <header className="sticky top-0 z-10 flex items-center justify-between border-b pb-2 lg:pb-4 mb-4 lg:mb-6 w-full px-4 lg:px-8 bg-white pt-4">
        <button
          onClick={() => navigate(-1)}
          className="w-8 h-8 lg:w-10 lg:h-10 bg-yellow-300 rounded-full flex items-center justify-center hover:bg-yellow-400 transition-colors duration-200"
          disabled={isSubmitting}
        >
          <i className="fas fa-arrow-left"></i>
        </button>
        <h1 className="absolute left-1/2 transform -translate-x-1/2 text-xl lg:text-2xl font-bold">
          Kelola Akun
        </h1>
      </header>

      <main className="mr-4 ml-4">
        <Form method="post">
          <input type="hidden" name="id" value={user.id} />
          
          <div className="flex justify-center mb-4">
            <div className="bg-white w-14 h-14 rounded-full flex items-center justify-center">
              <i className="fas fa-user-circle text-7xl text-gray-300"></i>
            </div>
          </div>

          <div className="mb-4">
            <label htmlFor="username" className="block font-bold mb-1">Username</label>
            <input
              id="username"
              type="text"
              name="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="bg-gray-200 p-2 rounded w-full focus:ring-2 focus:ring-yellow-300 transition-all duration-200"
              disabled={isSubmitting}
            />
          </div>

          <div className="mb-4">
            <label htmlFor="email" className="block font-bold mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              name="email"
              value={email}
              className="bg-gray-300 p-2 rounded w-full cursor-not-allowed text-gray-600"
              disabled={true}
              readOnly
            />
          </div>

          <div className="mb-4">
            <label htmlFor="phone" className="block font-bold mb-1">No.Handphone</label>
            <input
              id="phone"
              type="text"
              name="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="bg-gray-200 p-2 rounded w-full focus:ring-2 focus:ring-yellow-300 transition-all duration-200"
              disabled={isSubmitting}
            />
          </div>

          <div className="mb-4">
            <label htmlFor="name" className="block font-bold mb-1">Nama Lengkap</label>
            <input
              id="name"
              type="text"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-gray-200 p-2 rounded w-full focus:ring-2 focus:ring-yellow-300 transition-all duration-200"
              disabled={isSubmitting}
            />
          </div>

          <div className="mb-4">
            <label htmlFor="province" className="block font-bold mb-1">Provinsi</label>
            <div className="relative">
              <select
                id="province"
                name="province"
                value={province}
                onChange={handleProvinceChange}
                className="bg-gray-200 p-2 rounded w-full focus:ring-2 focus:ring-yellow-300 transition-all duration-200"
                disabled={isSubmitting || isLoadingProvinces}
              >
                <option value="">Pilih Provinsi</option>
                {provinces.map((provinceItem) => (
                  <option key={provinceItem.id} value={provinceItem.id}>
                    {provinceItem.name}
                  </option>
                ))}
              </select>
              {isLoadingProvinces && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <SpinningLoader size="small" color="yellow" />
                </div>
              )}
            </div>
          </div>

          <div className="mb-4">
            <label htmlFor="city" className="block font-bold mb-1">Kota</label>
            <div className="relative">
              <select
                id="city"
                name="city"
                value={city}
                onChange={handleCityChange}
                className="bg-gray-200 p-2 rounded w-full focus:ring-2 focus:ring-yellow-300 transition-all duration-200"
                disabled={isSubmitting || isLoadingCities || !province}
              >
                <option value="">Pilih Kota</option>
                {cities.map((cityItem) => (
                  <option key={cityItem.id} value={cityItem.id}>
                    {cityItem.name}
                  </option>
                ))}
              </select>
              {isLoadingCities && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <SpinningLoader size="small" color="yellow" />
                </div>
              )}
            </div>
          </div>

          <div className="mb-4">
            <label htmlFor="district" className="block font-bold mb-1">Kecamatan</label>
            <div className="relative">
              <select
                id="district"
                name="district"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="bg-gray-200 p-2 rounded w-full focus:ring-2 focus:ring-yellow-300 transition-all duration-200"
                disabled={isSubmitting || isLoadingSubdistricts || !city}
              >
                <option value="">Pilih Kecamatan</option>
                {subdistricts.map((subdistrict) => (
                  <option key={subdistrict.id} value={subdistrict.id}>
                    {subdistrict.name}
                  </option>
                ))}
              </select>
              {isLoadingSubdistricts && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <SpinningLoader size="small" color="yellow" />
                </div>
              )}
            </div>
          </div>

          <div className="mb-4">
            <label htmlFor="postalCode" className="block font-bold mb-1">Kode Pos</label>
            <input
              id="postalCode"
              type="text"
              name="postalCode"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              className="bg-gray-200 p-2 rounded w-full focus:ring-2 focus:ring-yellow-300 transition-all duration-200"
              disabled={isSubmitting}
              placeholder="Masukkan kode pos"
            />
          </div>

          <div className="mb-4">
            <label htmlFor="address" className="block font-bold mb-1">Alamat</label>
            <input
              id="address"
              type="text"
              name="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="bg-gray-200 p-2 rounded w-full focus:ring-2 focus:ring-yellow-300 transition-all duration-200"
              disabled={isSubmitting}
            />
          </div>

          <div className="flex justify-center">
            <button 
              type="submit"
              className="w-full p-3 bg-yellow-300 text-black font-bold rounded shadow-md hover:bg-yellow-400 transition-all duration-200 relative flex items-center justify-center"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <DoubleRingSpinner size="small" />
                  <span className="ml-2">Menyimpan...</span>
                </>
              ) : (
                "Simpan"
              )}
            </button>
          </div>
        </Form>
      </main>
    </div>
  );
};

export default KelolaAkunPage;