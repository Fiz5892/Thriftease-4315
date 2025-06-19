import { redirect, LoaderFunctionArgs, ActionFunctionArgs, json } from "@remix-run/node";
import { useNavigate, useNavigation, useLoaderData, Form } from "@remix-run/react";
import { useState } from "react";
import {
  SpinningLoader,
  LoadingOverlay,
} from "../routes/components/SpinningLoader";
import { requireAdminSession, sessionStorage } from "~/utils/session.server";

// Loader to check admin session and get admin data
export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const admin = await requireAdminSession(request);
    return json({ 
      admin: {
        name: admin.fullName || "Admin",
        email: admin.email
      }
    });
  } catch (error) {
    // If not authenticated or not admin, redirect to admin login
    throw redirect("/admin/login");
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const formData = await request.formData();
    const actionType = formData.get("actionType");
    
    console.log("Action type:", actionType); // Debug log
    
    if (actionType === "logout") {
      console.log("Processing admin logout..."); // Debug log
      // Handle admin logout directly with correct redirect
      const session = await sessionStorage.getSession(request.headers.get("Cookie"));
      return redirect("/admin/login", {
        headers: { "Set-Cookie": await sessionStorage.destroySession(session) },
      });
    }
    
    return json({ success: true });
  } catch (error) {
    console.error("Action error:", error);
    return json({ error: "Logout failed" }, { status: 500 });
  }
};

export default function MenuAdminPage() {
  const navigate = useNavigate();
  const navigation = useNavigation();
  const { admin } = useLoaderData<typeof loader>();
  const [loadingButton, setLoadingButton] = useState<string | null>(null);

  // Check if page is loading
  const isPageLoading = navigation.state === "loading";

  const handleNavigation = (path: string, buttonId: string) => {
    setLoadingButton(buttonId);
    navigate(path);
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-white">
      {/* Loading Overlay untuk page loading */}
      <LoadingOverlay
        isVisible={isPageLoading}
        text="Memuat halaman..."
        blur={true}
      />

      {/* Header dengan ikon user */}
      <div className="w-full bg-yellow-300 p-6 flex flex-col items-center">
        <div className="bg-gray-300 w-14 h-14 rounded-full flex items-center justify-center">
          <i className="fas fa-user-circle text-6xl text-white"></i>
        </div>
        <div className="flex justify-center w-full mt-2">
          <span className="text-xl font-bold text-center">{admin.name}</span>
        </div>
        {admin.email && (
          <div className="flex justify-center w-full mt-1">
            <span className="text-sm text-gray-700">{admin.email}</span>
          </div>
        )}
      </div>

      {/* Tombol Navigasi */}
      <div className="w-full flex flex-col items-center space-y-4 mt-16 relative">
        <button
          onClick={() => handleNavigation("/admin-dashboard", "dashboard")}
          disabled={isPageLoading || loadingButton !== null}
          className="w-11/12 relative p-4 bg-white rounded-lg shadow-md border border-black flex items-center justify-center hover:bg-gray-50 transition-colors duration-200 disabled:opacity-50"
        >
          <span className="text-lg font-semibold">Dashboard</span>
          <div className="absolute right-4 w-8 h-8 bg-yellow-300 rounded-full flex items-center justify-center">
            {loadingButton === "dashboard" ? (
              <SpinningLoader size="small" color="yellow" />
            ) : (
              <i className="fas fa-chevron-right text-black"></i>
            )}
          </div>
        </button>

        <button
          onClick={() => handleNavigation("/admin-pesanan", "pesanan")}
          disabled={isPageLoading || loadingButton !== null}
          className="w-11/12 relative p-4 bg-white rounded-lg shadow-md border border-black flex items-center justify-center hover:bg-gray-50 transition-colors duration-200 disabled:opacity-50"
        >
          <span className="text-lg font-semibold">Pesanan</span>
          <div className="absolute right-4 w-8 h-8 bg-yellow-300 rounded-full flex items-center justify-center">
            {loadingButton === "pesanan" ? (
              <SpinningLoader size="small" color="yellow" />
            ) : (
              <i className="fas fa-chevron-right text-black"></i>
            )}
          </div>
        </button>

        <button
          onClick={() => handleNavigation("/admin-transaksi", "transaksi")}
          disabled={isPageLoading || loadingButton !== null}
          className="w-11/12 relative p-4 bg-white rounded-lg shadow-md border border-black flex items-center justify-center hover:bg-gray-50 transition-colors duration-200 disabled:opacity-50"
        >
          <span className="text-lg font-semibold">Transaksi</span>
          <div className="absolute right-4 w-8 h-8 bg-yellow-300 rounded-full flex items-center justify-center">
            {loadingButton === "transaksi" ? (
              <SpinningLoader size="small" color="yellow" />
            ) : (
              <i className="fas fa-chevron-right text-black"></i>
            )}
          </div>
        </button>

        <button
          onClick={() => handleNavigation("/admin/productslist", "products")}
          disabled={isPageLoading || loadingButton !== null}
          className="w-11/12 relative p-4 bg-white rounded-lg shadow-md border border-black flex items-center justify-center hover:bg-gray-50 transition-colors duration-200 disabled:opacity-50"
        >
          <span className="text-lg font-semibold">Kelola Produk</span>
          <div className="absolute right-4 w-8 h-8 bg-yellow-300 rounded-full flex items-center justify-center">
            {loadingButton === "products" ? (
              <SpinningLoader size="small" color="yellow" />
            ) : (
              <i className="fas fa-chevron-right text-black"></i>
            )}
          </div>
        </button>

        {/* Logout button using Form for proper session handling */}
        <Form method="post" className="w-11/12">
          <input type="hidden" name="actionType" value="logout" />
          <button
            type="submit"
            disabled={isPageLoading || navigation.state === "submitting"}
            className="w-full relative p-4 bg-yellow-300 rounded-lg shadow-md border border-black flex items-center justify-center hover:bg-yellow-400 transition-colors duration-200 disabled:opacity-50"
          >
            {navigation.state === "submitting" ? (
              <div className="flex items-center">
                <SpinningLoader size="small" color="yellow" />
                <span className="text-lg font-semibold ml-2">Logging out...</span>
              </div>
            ) : (
              <span className="text-lg font-semibold">Log Out</span>
            )}
          </button>
        </Form>
      </div>
    </div>
  );
}