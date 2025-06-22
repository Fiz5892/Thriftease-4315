import React, { useState } from "react";
import { useNavigate, useLoaderData, Form } from "@remix-run/react";
import { ActionFunction, LoaderFunction, json } from "@remix-run/node";
import { PrismaClient } from "@prisma/client";
import {
  SpinningLoader,
  LoadingOverlay,
} from "../routes/components/SpinningLoader";

const prisma = new PrismaClient();

// Helper function untuk delete dari Cloudinary - HANYA DI SERVER
async function deleteFromCloudinary(imageUrl: string): Promise<void> {
  try {
    // Import cloudinary hanya di server-side
    const { v2: cloudinary } = await import('cloudinary');
    
    // Konfigurasi Cloudinary di server
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    // Extract public_id from URL
    const parts = imageUrl.split('/');
    const publicIdWithExtension = parts[parts.length - 1];
    const publicId = `thrift-products/${publicIdWithExtension.split('.')[0]}`;
    
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
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
    price: number;
    size: string;
    stock: number;
    category: string;
    description: string;
    images: ProductImage[];
}

interface LoaderData {
    product: Product;
}

export const action: ActionFunction = async ({ request }) => {
    const url = new URL(request.url);
    const imageId = url.searchParams.get('id');

    if (!imageId) {
        return json({ error: "Image ID not provided" }, { status: 400 });
    }

    try {
        // Ambil data gambar dari database
        const image = await prisma.productImage.findUnique({
            where: { id: imageId },
        });

        if (!image) {
            return json({ error: "Image not found" }, { status: 404 });
        }

        // Hapus gambar dari Cloudinary terlebih dahulu
        await deleteFromCloudinary(image.url);

        // Kemudian hapus dari database
        await prisma.productImage.delete({
            where: { id: imageId },
        });

        return json({ message: "Image deleted successfully from both Cloudinary and database" });
    } catch (error) {
        console.error('Error deleting image:', error);
        return json({ error: "Failed to delete image" }, { status: 500 });
    }
};

export const loader: LoaderFunction = async ({ request }) => {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) throw json({ error: "ID tidak ditemukan." }, { status: 400 });

    const product = await prisma.product.findUnique({
        where: { id },
        include: { images: true },
    });

    if (!product) {
        throw json({ error: "Produk tidak ditemukan." }, { status: 404 });
    }

    return json({ product });
};

const UbahProdukPage = () => {
    const navigate = useNavigate();
    const { product } = useLoaderData<LoaderData>();
    const [productState, setProductState] = useState<Product>(product);
    const [name, setName] = useState(product.name || "");
    const [price, setPrice] = useState(product.price?.toString() || "");
    const [size, setSize] = useState(product.size || "");
    const [stock, setStock] = useState(product.stock?.toString() || "");
    const [category, setCategory] = useState(product.category || "");
    const [description, setDescription] = useState(product.description || "");
    const [newImages, setNewImages] = useState<File[]>([]);
    const [previewUrls, setPreviewUrls] = useState<string[]>([]);
    const [isDescriptionPopupOpen, setIsDescriptionPopupOpen] = useState(false);
    
    // Loading states
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isNavigating, setIsNavigating] = useState(false);
    const [isDeletingImage, setIsDeletingImage] = useState<string | null>(null);
    const [isSuccessPopupVisible, setSuccessPopupVisible] = useState(false);

    const handleNavigation = async () => {
        setIsNavigating(true);
        try {
            navigate(-1);
        } catch (error) {
            console.error("Navigation error:", error);
            setIsNavigating(false);
        }
    };

    const handleUpdateProduct = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validasi input
        if (!name || !price || !size || !stock || !category || !description) {
            alert("Semua field harus diisi!");
            return;
        }

        if (isNaN(Number(price)) || isNaN(Number(stock))) {
            alert("Harga dan Stok harus berupa angka!");
            return;
        }

        setIsSubmitting(true);

        const formData = new FormData();
        formData.append("id", product.id.toString());
        formData.append("name", name);
        formData.append("price", price);
        formData.append("size", size);
        formData.append("stock", stock);
        formData.append("category", category);
        formData.append("description", description);

        // Tambahkan gambar baru ke FormData
        newImages.forEach((image) => {
            formData.append("images[]", image);
        });

        try {
            const response = await fetch(`/api/products`, {
                method: "PUT",
                body: formData,
            });

            if (response.ok) {
                const result = await response.json();
                console.log('Update success:', result);
                
                // Reset new images dan preview
                setNewImages([]);
                setPreviewUrls(prev => {
                    // Cleanup object URLs
                    prev.forEach(url => URL.revokeObjectURL(url));
                    return [];
                });
                
                setSuccessPopupVisible(true);
                setTimeout(() => {
                    setSuccessPopupVisible(false);
                    navigate("/admin/products");
                }, 3000);
            } else {
                const errorData = await response.json();
                alert(`Error: ${errorData.error || "Gagal memperbarui produk."}`);
            }
        } catch (err) {
            console.error('Update error:', err);
            alert("Terjadi kesalahan saat memperbarui produk.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleDescriptionPopup = () => {
        setIsDescriptionPopupOpen(!isDescriptionPopupOpen);
    };

    const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const formattedText = e.target.value
            .replace(/^- /gm, "• ")
            .replace(/\n/g, "<br/>");
        setDescription(formattedText);
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            
            // Validasi ukuran file (maksimal 5MB per file)
            const maxSize = 5 * 1024 * 1024; // 5MB
            const invalidFiles = files.filter(file => file.size > maxSize);
            
            if (invalidFiles.length > 0) {
                alert(`Beberapa file terlalu besar. Maksimal ukuran file adalah 5MB.`);
                return;
            }
            
            // Validasi tipe file
            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
            const invalidTypes = files.filter(file => !allowedTypes.includes(file.type));
            
            if (invalidTypes.length > 0) {
                alert(`Tipe file tidak didukung. Hanya file JPEG, JPG, PNG, dan WebP yang diizinkan.`);
                return;
            }
            
            setNewImages((prev) => [...prev, ...files]);

            // Generate URL untuk preview gambar
            const newPreviews = files.map((file) => URL.createObjectURL(file));
            setPreviewUrls((prev) => [...prev, ...newPreviews]);
        }
    };

    const handleRemovePreview = (index: number) => {
        setNewImages((prev) => prev.filter((_, i) => i !== index));
        setPreviewUrls((prev) => {
            const newUrls = prev.filter((_, i) => i !== index);
            // Revoke the URL to prevent memory leaks
            if (prev[index]) {
                URL.revokeObjectURL(prev[index]);
            }
            return newUrls;
        });
    };

    const handleDeleteImage = async (imageId: string) => {
        if (!confirm("Apakah Anda yakin ingin menghapus gambar ini? Gambar akan dihapus secara permanen dari server.")) {
            return;
        }

        setIsDeletingImage(imageId);
        
        try {
            const response = await fetch(`/editproduct?id=${imageId}`, {
                method: "DELETE",
            });

            if (response.ok) {
                const result = await response.json();
                console.log('Delete success:', result.message);
                
                // Update state untuk menghapus gambar dari UI
                const updatedImages = productState.images.filter((image) => image.id !== imageId);
                setProductState((prevState) => ({
                    ...prevState,
                    images: updatedImages,
                }));
                
                // Tampilkan notifikasi sukses
                alert("Gambar berhasil dihapus dari server dan database!");
            } else {
                const result = await response.json();
                console.error('Delete error:', result.error);
                alert(result.error || "Gagal menghapus gambar.");
            }
        } catch (error) {
            console.error("Error deleting image:", error);
            alert("Terjadi kesalahan saat menghapus gambar.");
        } finally {
            setIsDeletingImage(null);
        }
    };

    const handleDescriptionClick = () => {
        if (!isSubmitting && !isNavigating) {
            toggleDescriptionPopup();
        }
    };

    const handleDescriptionKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!isSubmitting && !isNavigating) {
                toggleDescriptionPopup();
            }
        }
    };

    const handleIconClick = () => {
        if (!isSubmitting && !isNavigating) {
            toggleDescriptionPopup();
        }
    };

    const handleIconKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!isSubmitting && !isNavigating) {
                toggleDescriptionPopup();
            }
        }
    };

    // Cleanup effect untuk preview URLs saat component unmount
    React.useEffect(() => {
        return () => {
            previewUrls.forEach(url => URL.revokeObjectURL(url));
        };
    }, [previewUrls]);

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Loading Overlay */}
            <LoadingOverlay
                isVisible={isSubmitting || isNavigating}
                text={isSubmitting ? "Memperbarui produk..." : "Memuat halaman..."}
                blur={true}
            />

            {/* Header */}
            <header className="bg-white shadow-md p-4 flex justify-center items-center sticky top-0 z-50">
                <button
                    className="absolute left-4 text-2xl text-black bg-yellow-300 w-10 h-10 rounded-full hover:bg-yellow-400 transition-colors duration-200 disabled:opacity-50 flex items-center justify-center"
                    onClick={handleNavigation}
                    disabled={isSubmitting || isNavigating}
                    aria-label="Kembali ke halaman sebelumnya"
                >
                    {isNavigating ? (
                        <SpinningLoader size="small" color="yellow" />
                    ) : (
                        <i className="fas fa-chevron-left" />
                    )}
                </button>
                <h1 className="text-xl font-bold text-center">Ubah Produk</h1>
            </header>
            
            <main className="m-4">
                <Form onSubmit={handleUpdateProduct} className="space-y-4">
                    <div className="flex flex-col items-center mb-4 mt-4">
                        <label 
                            htmlFor="imageUpload" 
                            className={`text-sm text-gray-500 cursor-pointer ${
                                isSubmitting || isNavigating ? "opacity-50 cursor-not-allowed" : ""
                            }`}
                        >
                            <div className="w-24 h-24 border-2 border-dashed border-gray-400 flex items-center justify-center hover:border-yellow-400 transition-colors duration-200">
                                <input
                                    type="file"
                                    multiple
                                    accept="image/jpeg,image/jpg,image/png,image/webp"
                                    onChange={handleImageUpload}
                                    className="hidden"
                                    id="imageUpload"
                                    disabled={isSubmitting || isNavigating}
                                />
                                <i className="fas fa-plus text-gray-400 text-2xl" aria-hidden="true"></i>
                            </div>
                            <span className="sr-only">Upload gambar produk</span>
                        </label>
                        <p className="text-xs text-gray-500 mt-2 text-center">
                            Format: JPEG, JPG, PNG, WebP<br/>
                            Maksimal: 5MB per file
                        </p>
                        
                        {/* Preview Gambar Baru */}
                        {previewUrls.length > 0 && (
                            <div className="flex flex-wrap gap-4 mt-4">
                                {previewUrls.map((url, index) => (
                                    <div key={index} className="relative">
                                        <img
                                            src={url}
                                            alt={`Preview ${index + 1}`}
                                            className="w-24 h-24 object-cover border border-gray-300 rounded-md"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleRemovePreview(index)}
                                            className="absolute -top-2 -right-2 w-6 h-6 text-white bg-red-500 rounded-full hover:bg-red-600 transition-colors duration-200 disabled:opacity-50 flex items-center justify-center text-xs"
                                            aria-label={`Hapus preview gambar ${index + 1}`}
                                            disabled={isSubmitting || isNavigating}
                                        >
                                            <i className="fas fa-times" aria-hidden="true"></i>
                                        </button>
                                        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 rounded-b-md">
                                            Baru
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Preview Gambar dari Database */}
                    {productState.images.length > 0 && (
                        <div className="mb-4">
                            <h3 className="text-sm font-medium text-gray-700 mb-2">Gambar Saat Ini:</h3>
                            <div className="flex flex-wrap gap-4">
                                {productState.images.map((image) => (
                                    <div key={image.id} className="relative">
                                        <img
                                            src={image.url}
                                            alt={`Gambar produk ${product.name}`}
                                            className="w-24 h-24 object-cover border border-gray-300 rounded-md"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteImage(image.id)}
                                            className="absolute -top-2 -right-2 w-6 h-6 text-white bg-red-500 rounded-full hover:bg-red-600 transition-colors duration-200 disabled:opacity-50 flex items-center justify-center text-xs"
                                            aria-label={`Hapus gambar produk`}
                                            disabled={isSubmitting || isNavigating || isDeletingImage === image.id}
                                        >
                                            {isDeletingImage === image.id ? (
                                                <SpinningLoader size="small" color="white" />
                                            ) : (
                                                <i className="fas fa-times" aria-hidden="true"></i>
                                            )}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Nama Produk"
                        className="w-full p-2 border rounded-md focus:outline-none focus:border-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="Nama Produk"
                        disabled={isSubmitting || isNavigating}
                    />
                    
                    <div className="flex items-center relative">
                        <div
                            className={`w-full p-2 border rounded-md bg-white text-gray-500 ${
                                isSubmitting || isNavigating ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:border-yellow-300"
                            }`}
                            onClick={handleDescriptionClick}
                            onKeyDown={handleDescriptionKeyDown}
                            dangerouslySetInnerHTML={{ __html: description || "Deskripsi Produk" }}
                            role="button"
                            tabIndex={0}
                            aria-label="Klik untuk mengedit deskripsi produk"
                        />
                        <i
                            className={`fas fa-pen absolute right-2 text-gray-500 ${
                                isSubmitting || isNavigating ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:text-yellow-500"
                            }`}
                            onClick={handleIconClick}
                            onKeyDown={handleIconKeyDown}
                            role="button"
                            tabIndex={0}
                            aria-label="Edit deskripsi"
                            aria-hidden="true"
                        />
                    </div>
                    
                    <div className="flex space-x-2">
                        <input
                            type="number"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            placeholder="Harga"
                            min="0"
                            step="0.01"
                            className="w-full p-2 border rounded-md focus:outline-none focus:border-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="Harga"
                            disabled={isSubmitting || isNavigating}
                        />
                        <input
                            type="text"
                            value={size}
                            onChange={(e) => setSize(e.target.value)}
                            placeholder="Ukuran"
                            className="w-full p-2 border rounded-md focus:outline-none focus:border-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="Ukuran"
                            disabled={isSubmitting || isNavigating}
                        />
                        <input
                            type="number"
                            value={stock}
                            onChange={(e) => setStock(e.target.value)}
                            placeholder="Stok"
                            min="0"
                            className="w-full p-2 border rounded-md focus:outline-none focus:border-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="Stok"
                            disabled={isSubmitting || isNavigating}
                        />
                    </div>
                    
                    <input
                        type="text"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        placeholder="Kategori"
                        className="w-full p-2 border rounded-md focus:outline-none focus:border-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="Kategori"
                        disabled={isSubmitting || isNavigating}
                    />
                    
                    <button
                        type="submit"
                        className="w-full p-2 bg-yellow-300 text-white rounded-md hover:bg-yellow-400 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 min-h-[40px]"
                        disabled={isSubmitting || isNavigating}
                    >
                        {isSubmitting ? (
                            <>
                                <SpinningLoader size="small" color="white" />
                                <span>Memperbarui...</span>
                            </>
                        ) : (
                            <span>Simpan Perubahan</span>
                        )}
                    </button>
                </Form>
            </main>

            {/* Success Popup */}
            {isSuccessPopupVisible && (
                <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-green-500 text-white p-4 rounded-lg shadow-lg z-50">
                    <div className="flex items-center space-x-2">
                        <i className="fas fa-check-circle" aria-hidden="true"></i>
                        <p className="font-semibold">
                            Produk berhasil diperbarui!
                        </p>
                    </div>
                </div>
            )}

            {/* Description Popup */}
            {isDescriptionPopupOpen && (
                <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4">
                    <div className="bg-white p-6 rounded-lg w-full max-w-md relative">
                        <button
                            type="button"
                            onClick={toggleDescriptionPopup}
                            className="absolute top-2 right-2 text-gray-600 text-xl hover:text-gray-800 transition-colors duration-200"
                            aria-label="Tutup popup deskripsi"
                        >
                            <i className="fas fa-times" aria-hidden="true"></i>
                        </button>
                        <h2 className="text-center text-lg font-semibold mb-4">
                            Masukkan Deskripsi Produk
                        </h2>
                        <textarea
                            rows={4}
                            placeholder="Masukkan deskripsi produk..."
                            value={description.replace(/<br\/>/g, "\n")}
                            onChange={handleDescriptionChange}
                            className="w-full p-3 border rounded-md text-gray-700 focus:outline-none focus:border-yellow-300 resize-none"
                            aria-label="Deskripsi Produk"
                        />
                        <div className="flex space-x-2 mt-4">
                            <button
                                type="button"
                                onClick={toggleDescriptionPopup}
                                className="flex-1 p-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors duration-200"
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                onClick={toggleDescriptionPopup}
                                className="flex-1 p-2 bg-yellow-300 text-white rounded-md hover:bg-yellow-400 transition-colors duration-200"
                            >
                                Simpan
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UbahProdukPage;