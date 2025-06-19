import { useState, useEffect } from "react";
import { useNavigate, useLoaderData, useNavigation, useFetcher } from "@remix-run/react";
import { json, type ActionFunctionArgs } from "@remix-run/node";
import { PrismaClient } from "@prisma/client";
import {
  SpinningLoader,
  LoadingOverlay,
} from "./components/SpinningLoader";

const prisma = new PrismaClient();

// Helper function untuk delete dari Cloudinary - HANYA DI SERVER
async function deleteFromCloudinary(imageUrl: string): Promise<void> {
  try {
    // Import cloudinary hanya di server-side
    const { v2: cloudinary } = await import("cloudinary");

    // Konfigurasi Cloudinary di server
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    // Extract public_id from URL
    const parts = imageUrl.split("/");
    const publicIdWithExtension = parts[parts.length - 1];
    const publicId = `thrift-products/${publicIdWithExtension.split(".")[0]}`;

    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error("Error deleting from Cloudinary:", error);
  }
}

// Type definitions
interface ProductImage {
  id: string;
  url: string;
  productId: string;
}

interface Product {
  id: string;
  name: string;
  size: string;
  price: number;
  stock: number;
  images: ProductImage[];
  updatedAt: string;
  createdAt: string;
}

interface LoaderData {
  products: Product[];
}

// Loader untuk mengambil data produk dengan sorting berdasarkan updatedAt
export const loader = async () => {
  const products = await prisma.product.findMany({
    include: { images: true },
    orderBy: [
      { updatedAt: "desc" }, // Urutkan berdasarkan updatedAt terbaru
      { createdAt: "desc" }, // Fallback ke createdAt jika updatedAt sama
    ],
  });
  return json({ products });
};

// Action untuk menghapus data produk dengan integrasi Cloudinary
export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  
  // Check for method override
  const method = formData.get("_method") || request.method;
  
  if (method === "DELETE") {
    const productId = formData.get("id") as string; // Changed from "productId" to "id"

    if (!productId) {
      return json({ error: "Product ID is required" }, { status: 400 });
    }

    try {
      // Ambil data produk beserta gambar
      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: { images: true },
      });

      if (!product) {
        return json({ error: "Product not found" }, { status: 404 });
      }

      console.log(
        `Menghapus produk: ${product.name} dengan ${product.images.length} gambar`
      );

      // Hapus semua gambar dari Cloudinary terlebih dahulu
      if (product.images.length > 0) {
        console.log("Menghapus gambar dari Cloudinary...");
        for (const image of product.images) {
          try {
            await deleteFromCloudinary(image.url);
            console.log(
              `Berhasil menghapus gambar dari Cloudinary: ${image.url}`
            );
          } catch (cloudinaryError) {
            console.error(
              `Gagal menghapus gambar dari Cloudinary: ${image.url}`,
              cloudinaryError
            );
            // Lanjutkan proses meskipun ada error menghapus dari Cloudinary
          }
        }
      }

      // Hapus produk dari database (gambar akan terhapus otomatis karena cascade)
      await prisma.product.delete({
        where: { id: productId },
      });

      console.log(`Berhasil menghapus produk dari database: ${product.name}`);

      return json({
        success: true,
        message: "Produk dan semua gambar berhasil dihapus dari server dan database",
        deletedImages: product.images.length,
      });
    } catch (error) {
      console.error("Error deleting product:", error);
      return json(
        {
          error: "Failed to delete product",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 }
      );
    }
  }

  // Handle other methods if needed
  return json({ error: "Method not allowed" }, { status: 405 });
};

// Komponen utama
const KelolaProdukPage = () => {
  const navigate = useNavigate();
  const navigation = useNavigation();
  const { products } = useLoaderData<LoaderData>();
  const fetcher = useFetcher();
  
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [showModal, setShowModal] = useState<boolean>(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [loadingStates, setLoadingStates] = useState<{
    [key: string]: boolean;
  }>({});

  // Check if page is loading
  const isPageLoading = navigation.state === "loading";
  const isSubmitting = navigation.state === "submitting" || fetcher.state === "submitting";

  const setLoading = (id: string, isLoading: boolean) => {
    setLoadingStates((prev) => ({
      ...prev,
      [id]: isLoading,
    }));
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  // Handle delete with useFetcher (Remix way)
  const handleDelete = () => {
    if (!selectedProduct) return;

    setLoading(`delete-${selectedProduct.id}`, true);

    fetcher.submit(
      { 
        id: selectedProduct.id,
        _method: "DELETE"
      },
      { 
        method: "post",
        action: "/admin/productslist"
      }
    );
  };

  // Handle fetcher response
  useEffect(() => {
    if (fetcher.data && fetcher.state === "idle") {
      const loadingKey = selectedProduct ? `delete-${selectedProduct.id}` : "";
      
      if (fetcher.data.success) {
        alert(
          `Produk "${selectedProduct?.name}" berhasil dihapus!${
            fetcher.data.deletedImages > 0 
              ? `\n${fetcher.data.deletedImages} gambar telah dihapus dari server.`
              : ""
          }`
        );
        
        // Refresh the page
        window.location.reload();
      } else {
        alert(`Gagal menghapus produk: ${fetcher.data.error || "Unknown error"}`);
      }
      
      setLoading(loadingKey, false);
      setShowModal(false);
      setSelectedProduct(null);
    }
  }, [fetcher.data, fetcher.state, selectedProduct]);

  // Alternative fetch method (backup)
  const handleDeleteWithFetch = async () => {
    if (!selectedProduct) return;

    setLoading(`delete-${selectedProduct.id}`, true);

    try {
      const formData = new FormData();
      formData.append("id", selectedProduct.id);
      formData.append("_method", "DELETE");

      const response = await fetch(window.location.pathname, {
        method: "POST",
        body: formData,
        headers: {
          "Accept": "application/json",
        },
      });

      const contentType = response.headers.get("content-type");
      
      if (!contentType?.includes("application/json")) {
        const text = await response.text();
        console.error("Non-JSON response:", text);
        throw new Error("Server returned unexpected response format");
      }

      const result = await response.json();

      if (response.ok && result.success) {
        alert(
          `Produk "${selectedProduct.name}" berhasil dihapus!${
            result.deletedImages > 0 
              ? `\n${result.deletedImages} gambar telah dihapus dari server.`
              : ""
          }`
        );
        
        window.location.reload();
      } else {
        alert(`Gagal menghapus produk: ${result.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Delete error:", error);
      alert(`Error: ${error instanceof Error ? error.message : "Terjadi kesalahan saat menghapus produk"}`);
    } finally {
      setLoading(`delete-${selectedProduct.id}`, false);
      setShowModal(false);
      setSelectedProduct(null);
    }
  };

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  const openDeleteModal = (product: Product) => {
    setSelectedProduct(product);
    setShowModal(true);
  };

  const closeDeleteModal = () => {
    setShowModal(false);
    setSelectedProduct(null);
  };

  // Filter produk berdasarkan search term, tetap mempertahankan urutan dari database
  const filteredProducts = products.filter((product: Product) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Fungsi untuk format tanggal
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Fungsi untuk menentukan apakah produk baru diupdate (dalam 24 jam terakhir)
  const isRecentlyUpdated = (updatedAt: string, createdAt: string) => {
    const updated = new Date(updatedAt);
    const created = new Date(createdAt);
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Produk dianggap baru diupdate jika updatedAt lebih baru dari createdAt
    // dan updatedAt dalam 24 jam terakhir
    return updated > created && updated > oneDayAgo;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Loading Overlay untuk page loading */}
      <LoadingOverlay
        isVisible={isPageLoading}
        text="Memuat halaman..."
        blur={true}
      />

      <header className="bg-gradient-to-r from-yellow-400 via-yellow-500 to-orange-400 shadow-xl backdrop-blur-sm">
        <div className="p-6 relative flex justify-center items-center">
          <button
            className="absolute left-6 text-yellow-900 bg-white/30 backdrop-blur-sm w-12 h-12 rounded-xl flex items-center justify-center hover:bg-white/40 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-50"
            onClick={() => handleNavigation("/admin-menu")}
            disabled={isPageLoading || isSubmitting}
          >
            {isPageLoading ? (
              <SpinningLoader size="small" color="yellow" />
            ) : (
              <i className="fas fa-arrow-left text-lg"></i>
            )}
          </button>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-yellow-900 mb-1">
              ThriftEase Admin
            </h1>
          </div>
        </div>
      </header>

      <div className="bg-gray-200 p-4 rounded-md relative flex justify-center items-center mb-4">
        <h2 className="text-lg font-semibold text-center w-full">Produk</h2>
        <button
          className="absolute right-4 bg-yellow-300 text-white w-10 h-10 rounded-full flex items-center justify-center hover:bg-yellow-400 transition-colors duration-200 disabled:opacity-50"
          onClick={() => handleNavigation("/admin/products")}
          disabled={isPageLoading || isSubmitting}
        >
          <i className="fas fa-plus"></i>
        </button>
      </div>

      <main className="p-4">
        <div className="mb-4 relative">
          <input
            type="text"
            placeholder="Cari produk..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="w-full p-2 pl-10 rounded-md border border-gray-300 focus:outline-none focus:border-yellow-300"
            disabled={isPageLoading || isSubmitting}
          />
          <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
        </div>

        {/* Info sorting */}
        {filteredProducts.map((product: Product) => (
          <div
            key={product.id}
            className={`bg-white p-4 rounded-md shadow-md flex items-start mb-4 relative ${
              isRecentlyUpdated(product.updatedAt, product.createdAt)
                ? "border-l-4 border-green-500"
                : ""
            }`}
          >
            {/* Badge untuk produk yang baru diupdate */}
            {isRecentlyUpdated(product.updatedAt, product.createdAt) && (
              <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                Baru Diupdate
              </div>
            )}

            <img
              src={product.images[0]?.url || "https://placehold.co/100x100"}
              alt={product.name}
              className="w-24 h-24 object-cover rounded-md mr-4"
              onError={(e) => {
                // Fallback jika gambar gagal dimuat
                const target = e.target as HTMLImageElement;
                target.src = "https://placehold.co/100x100?text=No+Image";
              }}
            />
            <div className="flex-1">
              <h3 className="text-sm font-semibold">{product.name}</h3>
              <p className="text-sm text-gray-500">Size: {product.size}</p>
              <p className="text-lg font-bold text-yellow-600">
                Rp {product.price.toLocaleString()}
              </p>

              {/* Informasi tanggal update */}
              <div className="text-xs text-gray-400 mt-1">
                Diupdate: {formatDate(product.updatedAt)}
              </div>

              {/* Info jumlah gambar */}
              {product.images.length > 0 && (
                <div className="text-xs text-blue-600 mt-1">
                  <i className="fas fa-images mr-1"></i>
                  {product.images.length} gambar tersimpan di cloud
                </div>
              )}

              <div className="text-end">
                <p className="text-sm text-gray-500 mb-2">
                  Stok: {product.stock}
                </p>
              </div>
              <div className="flex justify-end mt-6 space-x-2">
                <button
                  className="bg-yellow-300 text-gray-800 font-semibold py-1 px-4 rounded-lg text-[10px] lg:text-sm hover:bg-yellow-400 transition-colors duration-200 disabled:opacity-50"
                  onClick={() =>
                    handleNavigation(`/admin/productsedit?id=${product.id}`)
                  }
                  disabled={isPageLoading || isSubmitting}
                >
                  Ubah
                </button>
                <button
                  className="bg-red-400 text-gray-800 font-semibold py-1 px-4 rounded-lg text-[10px] lg:text-sm hover:bg-red-500 transition-colors duration-200 disabled:opacity-50"
                  onClick={() => openDeleteModal(product)}
                  disabled={isPageLoading || isSubmitting}
                >
                  Hapus
                </button>
              </div>
            </div>
          </div>
        ))}

        {filteredProducts.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            {searchTerm
              ? "Tidak ada produk yang sesuai dengan pencarian"
              : "Belum ada produk"}
          </div>
        )}
      </main>

      {/* Modal Konfirmasi Hapus */}
      {showModal && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-96 max-w-[90vw]">
            <h2 className="text-lg font-bold mb-4">Konfirmasi Penghapusan</h2>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                Apakah Anda yakin ingin menghapus produk ini?
              </p>
              <div className="bg-red-50 p-3 rounded-md border-l-4 border-red-400">
                <p className="text-sm font-medium text-red-800 mb-1">
                  {selectedProduct.name}
                </p>
                <p className="text-xs text-red-600">
                  <i className="fas fa-exclamation-triangle mr-1"></i>
                  Produk dan semua gambar ({selectedProduct.images.length} file)
                  akan dihapus secara permanen dari server cloud.
                </p>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>
            <div className="flex justify-end space-x-4">
              <button
                className="bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors duration-200 disabled:opacity-50"
                onClick={closeDeleteModal}
                disabled={loadingStates[`delete-${selectedProduct.id}`] || fetcher.state === "submitting"}
              >
                Batal
              </button>
              <button
                className="bg-red-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-red-600 transition-colors duration-200 disabled:opacity-50 flex items-center space-x-2 min-w-[80px] justify-center"
                onClick={handleDelete}
                disabled={loadingStates[`delete-${selectedProduct.id}`] || fetcher.state === "submitting"}
              >
                {(loadingStates[`delete-${selectedProduct.id}`] || fetcher.state === "submitting") ? (
                  <>
                    <SpinningLoader size="small" color="white" />
                    <span>...</span>
                  </>
                ) : (
                  <>
                    <i className="fas fa-trash mr-1"></i>
                    <span>Hapus</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KelolaProdukPage;