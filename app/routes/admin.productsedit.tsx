import React, { useState } from "react";
import { useNavigate, useLoaderData, Form } from "@remix-run/react";
import { ActionFunction, LoaderFunction, json } from "@remix-run/node";
import { PrismaClient } from "@prisma/client";
import {
  SpinningLoader,
  LoadingOverlay,
} from "../routes/components/SpinningLoader";

const prisma = new PrismaClient();

// Helper function untuk upload ke Cloudinary - HANYA DI SERVER
async function uploadToCloudinary(file: File, folder: string = 'thrift-products'): Promise<string> {
  try {
    console.log('Uploading to Cloudinary:', file.name);
    
    // Import cloudinary hanya di server-side
    const { v2: cloudinary } = await import('cloudinary');
    
    // Konfigurasi Cloudinary di server
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    // Convert File to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Cloudinary
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: folder,
          resource_type: 'image',
          transformation: [
            { width: 800, height: 800, crop: 'limit' },
            { quality: 'auto:good' }
          ],
        },
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            reject(error);
          } else {
            console.log('Cloudinary upload success:', result?.secure_url);
            resolve(result);
          }
        }
      ).end(buffer);
    });

    return (result as any).secure_url;
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    throw new Error(`Failed to upload image: ${error}`);
  }
}

// Helper function untuk delete dari Cloudinary - HANYA DI SERVER
async function deleteFromCloudinary(imageUrl: string): Promise<void> {
  try {
    console.log('Attempting to delete from Cloudinary:', imageUrl);
    
    // Import cloudinary hanya di server-side
    const { v2: cloudinary } = await import('cloudinary');
    
    // Konfigurasi Cloudinary di server
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    // Extract public_id from URL dengan lebih robust
    let publicId = '';
    
    // Jika URL mengandung '/upload/', ambil bagian setelahnya
    if (imageUrl.includes('/upload/')) {
      const uploadIndex = imageUrl.indexOf('/upload/') + 8;
      const afterUpload = imageUrl.substring(uploadIndex);
      
      // Hapus version jika ada (contoh: v1234567890/)
      const withoutVersion = afterUpload.replace(/^v\d+\//, '');
      
      // Hapus extension
      publicId = withoutVersion.substring(0, withoutVersion.lastIndexOf('.'));
    } else {
      // Fallback ke method lama
      const parts = imageUrl.split('/');
      const publicIdWithExtension = parts[parts.length - 1];
      publicId = `thrift-products/${publicIdWithExtension.split('.')[0]}`;
    }
    
    console.log('Extracted public_id:', publicId);
    
    const result = await cloudinary.uploader.destroy(publicId);
    console.log('Cloudinary deletion result:', result);
    
    if (result.result !== 'ok' && result.result !== 'not found') {
      throw new Error(`Cloudinary deletion failed: ${result.result}`);
    }
    
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    // Tidak throw error agar tidak mengganggu penghapusan dari database
    // Uncomment baris berikut jika ingin strict error handling
    // throw error;
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
    console.log('Action called - Method:', request.method);
    console.log('Action called - URL:', request.url);

    // Handle PUT request untuk update produk
    if (request.method === "PUT") {
        const formData = await request.formData();
        const id = formData.get("id") as string;
        const name = formData.get("name") as string;
        const price = formData.get("price") as string;
        const size = formData.get("size") as string;
        const stock = formData.get("stock") as string;
        const category = formData.get("category") as string;
        const description = formData.get("description") as string;
        
        // Array gambar yang akan dihapus
        const imagesToDelete = formData.getAll("imagesToDelete") as string[];
        
        // Array gambar baru yang akan di-upload
        const newImages = formData.getAll("images[]") as File[];

        try {
            // Update product data
            const updatedProduct = await prisma.product.update({
                where: { id },
                data: {
                    name,
                    price: parseFloat(price),
                    size,
                    stock: parseInt(stock),
                    category,
                    description,
                },
            });

            // Hapus gambar yang ditandai untuk dihapus
            if (imagesToDelete.length > 0) {
                console.log('Deleting images:', imagesToDelete);
                
                // Ambil data gambar yang akan dihapus
                const imagesToDeleteFromDB = await prisma.productImage.findMany({
                    where: { id: { in: imagesToDelete } },
                });

                // Hapus dari Cloudinary
                for (const image of imagesToDeleteFromDB) {
                    await deleteFromCloudinary(image.url);
                }

                // Hapus dari database
                await prisma.productImage.deleteMany({
                    where: { id: { in: imagesToDelete } },
                });
            }

            // Upload gambar baru ke Cloudinary dan simpan ke database
            if (newImages.length > 0) {
                console.log('Uploading new images:', newImages.length);
                
                const uploadedImages = [];
                
                for (const file of newImages) {
                    if (file && file.size > 0) {
                        try {
                            // Upload ke Cloudinary
                            const imageUrl = await uploadToCloudinary(file, 'thrift-products');
                            
                            // Simpan ke database
                            const savedImage = await prisma.productImage.create({
                                data: {
                                    url: imageUrl,
                                    productId: id,
                                },
                            });
                            
                            uploadedImages.push(savedImage);
                            console.log('Successfully uploaded and saved image:', imageUrl);
                        } catch (uploadError) {
                            console.error('Error uploading image:', uploadError);
                            // Continue dengan gambar lainnya, jangan stop prosesnya
                        }
                    }
                }
                
                console.log(`Successfully uploaded ${uploadedImages.length} out of ${newImages.length} images`);
            }

            // Ambil data produk lengkap dengan gambar terbaru
            const finalProduct = await prisma.product.findUnique({
                where: { id },
                include: { images: true },
            });

            return json({ 
                success: true,
                message: "Product updated successfully",
                product: finalProduct 
            }, {
                status: 200,
                headers: {
                    "Content-Type": "application/json"
                }
            });
            
        } catch (error) {
            console.error('Error updating product:', error);
            
            return json({ 
                success: false,
                error: "Failed to update product",
                details: error instanceof Error ? error.message : String(error)
            }, { 
                status: 500,
                headers: {
                    "Content-Type": "application/json"
                }
            });
        }
    }

    // Method tidak didukung
    return json({ 
        success: false,
        error: "Method not allowed" 
    }, { 
        status: 405,
        headers: {
            "Content-Type": "application/json"
        }
    });
};

export const loader: LoaderFunction = async ({ request }) => {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    
    console.log('Loader called with product ID:', id);
    
    if (!id) {
        console.error('Product ID not found in query params');
        throw json({ error: "ID tidak ditemukan." }, { status: 400 });
    }

    try {
        const product = await prisma.product.findUnique({
            where: { id },
            include: { images: true },
        });

        console.log('Found product:', product);

        if (!product) {
            console.error('Product not found in database');
            throw json({ error: "Produk tidak ditemukan." }, { status: 404 });
        }

        return json({ product });
    } catch (error) {
        console.error('Error loading product:', error);
        throw json({ error: "Gagal memuat data produk." }, { status: 500 });
    }
};

const UbahProdukPage = () => {
    const navigate = useNavigate();
    const { product } = useLoaderData<LoaderData>();
    const [name, setName] = useState(product.name || "");
    const [price, setPrice] = useState(product.price?.toString() || "");
    const [size, setSize] = useState(product.size || "");
    const [stock, setStock] = useState(product.stock?.toString() || "");
    const [category, setCategory] = useState(product.category || "");
    const [description, setDescription] = useState(product.description || "");
    const [newImages, setNewImages] = useState<File[]>([]);
    const [previewUrls, setPreviewUrls] = useState<string[]>([]);
    const [isDescriptionPopupOpen, setIsDescriptionPopupOpen] = useState(false);
    
    // State untuk gambar yang akan dihapus (soft delete)
    const [imagesToDelete, setImagesToDelete] = useState<string[]>([]);
    
    // Loading states
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isNavigating, setIsNavigating] = useState(false);
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

        console.log('handleUpdateProduct called');

        // Validasi input
        if (!name || !price || !size || !stock || !category || !description) {
            alert("Semua field harus diisi!");
            return;
        }

        if (isNaN(Number(price)) || isNaN(Number(stock))) {
            alert("Harga dan Stok harus berupa angka!");
            return;
        }

        if (Number(price) < 0 || Number(stock) < 0) {
            alert("Harga dan Stok tidak boleh negatif!");
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
        console.log('Adding new images to FormData:', newImages.length);
        newImages.forEach((image, index) => {
            console.log(`Adding image ${index}:`, image.name, image.size);
            formData.append("images[]", image);
        });

        // Tambahkan ID gambar yang akan dihapus
        imagesToDelete.forEach((imageId) => {
            formData.append("imagesToDelete", imageId);
        });

        try {
            console.log('Sending update request to current route');
            const response = await fetch(window.location.pathname + window.location.search, {
                method: "PUT",
                body: formData,
            });

            console.log('Update response status:', response.status);
            console.log('Update response headers:', response.headers.get('content-type'));

            const contentType = response.headers.get('content-type');
            
            if (response.ok) {
                let result;
                
                // Cek apakah response adalah JSON
                if (contentType && contentType.includes('application/json')) {
                    try {
                        result = await response.json();
                        console.log('Update success:', result);
                        
                        // Cek apakah response mengandung success flag
                        if (result.success) {
                            // Reset new images dan preview
                            setNewImages([]);
                            setPreviewUrls(prev => {
                                // Cleanup object URLs
                                prev.forEach(url => URL.revokeObjectURL(url));
                                return [];
                            });
                            
                            // Reset imagesToDelete
                            setImagesToDelete([]);
                            
                            setSuccessPopupVisible(true);
                            setTimeout(() => {
                                setSuccessPopupVisible(false);
                                navigate("/admin/productslist");
                            }, 3000);
                        } else {
                            console.error('Update failed:', result);
                            alert(`Error: ${result.error || "Gagal memperbarui produk."}`);
                        }
                    } catch (jsonError) {
                        console.error('JSON parsing error:', jsonError);
                        
                        // Jika JSON parsing gagal tapi status 200, anggap berhasil
                        console.log('Assuming success due to 200 status despite JSON error');
                        
                        // Reset new images dan preview
                        setNewImages([]);
                        setPreviewUrls(prev => {
                            prev.forEach(url => URL.revokeObjectURL(url));
                            return [];
                        });
                        
                        // Reset imagesToDelete
                        setImagesToDelete([]);
                        
                        setSuccessPopupVisible(true);
                        setTimeout(() => {
                            setSuccessPopupVisible(false);
                            navigate("/admin/productslist");
                        }, 3000);
                    }
                } else {
                    // Response bukan JSON, tapi status 200 - anggap berhasil
                    console.log('Non-JSON response with 200 status, assuming success');
                    const textResponse = await response.text();
                    console.log('Response text:', textResponse);
                    
                    // Reset new images dan preview
                    setNewImages([]);
                    setPreviewUrls(prev => {
                        prev.forEach(url => URL.revokeObjectURL(url));
                        return [];
                    });
                    
                    // Reset imagesToDelete
                    setImagesToDelete([]);
                    
                    setSuccessPopupVisible(true);
                    setTimeout(() => {
                        setSuccessPopupVisible(false);
                        navigate("/admin/productslist");
                    }, 3000);
                }
            } else {
                // Status bukan 200
                try {
                    const errorData = await response.json();
                    console.error('Update error:', errorData);
                    alert(`Error: ${errorData.error || "Gagal memperbarui produk."}`);
                } catch (jsonError) {
                    // Gagal parse JSON error response
                    const errorText = await response.text();
                    console.error('Non-JSON error response:', errorText);
                    alert(`Error: HTTP ${response.status} - ${response.statusText}`);
                }
            }
        } catch (err) {
            console.error('Network or other error:', err);
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
            
            console.log('Adding new images:', files.length);
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

    // Fungsi untuk soft delete gambar (hanya hide dari UI)
    const handleMarkImageForDeletion = (imageId: string) => {
        console.log('Marking image for deletion:', imageId);
        
        if (!imagesToDelete.includes(imageId)) {
            setImagesToDelete(prev => [...prev, imageId]);
        }
    };

    // Fungsi untuk membatalkan penghapusan gambar
    const handleRestoreImage = (imageId: string) => {
        console.log('Restoring image:', imageId);
        setImagesToDelete(prev => prev.filter(id => id !== imageId));
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

    // Filter gambar yang tidak ditandai untuk dihapus
    const visibleImages = product.images.filter(image => !imagesToDelete.includes(image.id));

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
                    {visibleImages.length > 0 && (
                        <div className="mb-4">
                            <h3 className="text-sm font-medium text-gray-700 mb-2">Gambar Saat Ini:</h3>
                            <div className="flex flex-wrap gap-4">
                                {visibleImages.map((image) => (
                                    <div key={image.id} className="relative">
                                        <img
                                            src={image.url}
                                            alt={`Gambar produk ${product.name}`}
                                            className="w-24 h-24 object-cover border border-gray-300 rounded-md"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleMarkImageForDeletion(image.id)}
                                            className="absolute -top-2 -right-2 w-6 h-6 text-white bg-red-500 rounded-full hover:bg-red-600 transition-colors duration-200 disabled:opacity-50 flex items-center justify-center text-xs"
                                            aria-label={`Hapus gambar produk`}
                                            disabled={isSubmitting || isNavigating}
                                        >
                                            <i className="fas fa-times" aria-hidden="true"></i>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Gambar yang ditandai untuk dihapus */}
                    {imagesToDelete.length > 0 && (
                        <div className="mb-4">
                            <h3 className="text-sm font-medium text-red-600 mb-2">
                                Gambar yang akan dihapus saat disimpan ({imagesToDelete.length}):
                            </h3>
                            <div className="flex flex-wrap gap-4">
                                {product.images
                                    .filter(image => imagesToDelete.includes(image.id))
                                    .map((image) => (
                                        <div key={image.id} className="relative">
                                            <img
                                                src={image.url}
                                                alt={`Gambar yang akan dihapus`}
                                                className="w-24 h-24 object-cover border border-red-300 rounded-md opacity-50"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handleRestoreImage(image.id)}
                                                className="absolute -top-2 -right-2 w-6 h-6 text-white bg-green-500 rounded-full hover:bg-green-600 transition-colors duration-200 disabled:opacity-50 flex items-center justify-center text-xs"
                                                aria-label="Batalkan penghapusan gambar"
                                                disabled={isSubmitting || isNavigating}
                                                title="Klik untuk membatalkan penghapusan"
                                            >
                                                <i className="fas fa-undo" aria-hidden="true"></i>
                                            </button>
                                            <div className="absolute bottom-0 left-0 right-0 bg-red-500 bg-opacity-75 text-white text-xs p-1 rounded-b-md text-center">
                                                Akan dihapus
                                            </div>
                                        </div>
                                    ))}
                            </div>
                            <p className="text-xs text-red-600 mt-2">
                                Gambar di atas akan dihapus permanen saat Anda menekan "Simpan Perubahan". 
                                Klik tombol hijau untuk membatalkan penghapusan.
                            </p>
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