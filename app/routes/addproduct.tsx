import { useState, useEffect } from "react";
import { useNavigate } from "@remix-run/react";
import {
  SpinningLoader,
  LoadingOverlay,
} from "../routes/components/SpinningLoader";

const TambahProdukPage = () => {
  const navigate = useNavigate();
  const [description, setDescription] = useState("");
  const [name, setName] = useState("");
  const [size, setSize] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [category, setCategory] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [isSuccessPopupVisible, setSuccessPopupVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isDescriptionPopupOpen, setIsDescriptionPopupOpen] = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const fileArray = Array.from(files);
      
      // Validasi ukuran file (maksimal 5MB per file)
      const maxSize = 5 * 1024 * 1024; // 5MB
      const invalidFiles = fileArray.filter(file => file.size > maxSize);
      
      if (invalidFiles.length > 0) {
        alert(`Beberapa file terlalu besar. Maksimal ukuran file adalah 5MB.`);
        return;
      }
      
      // Validasi tipe file
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      const invalidTypes = fileArray.filter(file => !allowedTypes.includes(file.type));
      
      if (invalidTypes.length > 0) {
        alert(`Tipe file tidak didukung. Hanya file JPEG, JPG, PNG, dan WebP yang diizinkan.`);
        return;
      }
      
      const previews: string[] = fileArray.map((file) =>
        URL.createObjectURL(file)
      );
      setImages((prevImages) => [...prevImages, ...fileArray]);
      setPreviewImages((prevPreviews) => [...prevPreviews, ...previews]);
    }
  };

  const removeImage = (index: number) => {
    // Revoke URL untuk mencegah memory leak
    if (previewImages[index]) {
      URL.revokeObjectURL(previewImages[index]);
    }
    
    setImages((prevImages) => prevImages.filter((_, i) => i !== index));
    setPreviewImages((prevPreviews) =>
      prevPreviews.filter((_, i) => i !== index)
    );
  };

  const handleNavigation = async () => {
    setIsNavigating(true);
    try {
      navigate("/admin/productslist", { replace: true });
    } catch (error) {
      console.error("Navigation error:", error);
      setIsNavigating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !description || !size || !price || !stock || !category) {
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

    try {
      const formData = new FormData();
      formData.append("name", name);
      formData.append("description", description);
      formData.append("size", size);
      formData.append("price", price);
      formData.append("stock", stock);
      formData.append("category", category);

      // Append images dengan nama yang sama seperti di API
      if (images.length > 0) {
        images.forEach((image) => formData.append("images[]", image));
      }

      const response = await fetch("/api/products", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Product created:', result);
        
        // Reset form
        setName("");
        setDescription("");
        setSize("");
        setPrice("");
        setStock("");
        setCategory("");
        setImages([]);
        setPreviewImages(prev => {
          // Cleanup object URLs
          prev.forEach(url => URL.revokeObjectURL(url));
          return [];
        });
        
        setSuccessPopupVisible(true);
        setTimeout(() => {
          setSuccessPopupVisible(false);
          navigate("/admin/productslist");
        }, 3000);
      } else {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        alert(`Error: ${errorData.error || "Gagal menambah produk"}`);
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      alert("Terjadi kesalahan saat menambah produk");
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
  useEffect(() => {
    return () => {
      previewImages.forEach((preview) => URL.revokeObjectURL(preview));
    };
  }, [previewImages]);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Loading Overlay untuk submit form dan navigation */}
      <LoadingOverlay
        isVisible={isSubmitting || isNavigating}
        text={isSubmitting ? "Menambahkan produk..." : "Memuat halaman..."}
        blur={true}
      />

      <header className="bg-white shadow-md p-4 flex justify-center items-center sticky top-0 z-50">
        <button
          className="absolute left-4 text-2xl text-black bg-yellow-300 w-10 h-10 rounded-full hover:bg-yellow-400 transition-colors duration-200 disabled:opacity-50 flex items-center justify-center"
          onClick={handleNavigation}
          disabled={isSubmitting || isNavigating}
          aria-label="Kembali ke halaman daftar produk"
        >
          {isNavigating ? (
            <SpinningLoader size="small" color="yellow" />
          ) : (
            <i className="fas fa-arrow-left"></i>
          )}
        </button>
        <h1 className="text-xl font-bold text-center">Tambah Produk</h1>
      </header>
      
      <main className="m-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col items-center mb-4 mt-4">
            <div className="flex flex-col items-center mt-4">
              <div className="w-full max-w-md border-2 border-dashed border-gray-400 p-6 rounded-lg flex flex-col items-center justify-center hover:border-yellow-400 transition-colors duration-200">
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  multiple
                  onChange={handleImageChange}
                  className="hidden"
                  id="product-images"
                  disabled={isSubmitting || isNavigating}
                />
                <label
                  htmlFor="product-images"
                  className={`cursor-pointer flex flex-col items-center justify-center ${
                    isSubmitting || isNavigating ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  <i className="fas fa-plus text-gray-400 text-3xl mb-2"></i>
                  <span className="text-sm text-gray-400">Tambah Gambar</span>
                </label>
              </div>
              <p className="text-xs text-gray-500 mt-2 text-center">
                Format: JPEG, JPG, PNG, WebP<br/>
                Maksimal: 5MB per file
              </p>

              {/* Preview Images */}
              {previewImages.length > 0 && (
                <div className="grid grid-cols-3 gap-4 mt-4">
                  {previewImages.map((src, index) => (
                    <div
                      key={index}
                      className="relative w-24 h-24 border rounded-lg overflow-hidden"
                    >
                      <img
                        src={src}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm shadow-md hover:bg-red-600 transition-colors duration-200 disabled:opacity-50"
                        disabled={isSubmitting || isNavigating}
                        aria-label={`Hapus gambar ${index + 1}`}
                      >
                        <i className="fas fa-times" aria-hidden="true"></i>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <input
            type="text"
            placeholder="Nama Produk"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-2 border rounded-md focus:outline-none focus:border-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSubmitting || isNavigating}
            aria-label="Nama Produk"
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
              placeholder="Harga"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              min="0"
              step="0.01"
              className="w-full p-2 border rounded-md focus:outline-none focus:border-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting || isNavigating}
              aria-label="Harga"
            />
            <input
              type="text"
              placeholder="Ukuran"
              value={size}
              onChange={(e) => setSize(e.target.value)}
              className="w-full p-2 border rounded-md focus:outline-none focus:border-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting || isNavigating}
              aria-label="Ukuran"
            />
            <input
              type="number"
              placeholder="Stok"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              min="0"
              className="w-full p-2 border rounded-md focus:outline-none focus:border-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting || isNavigating}
              aria-label="Stok"
            />
          </div>
          
          <input
            type="text"
            placeholder="Kategori"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full p-2 border rounded-md focus:outline-none focus:border-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSubmitting || isNavigating}
            aria-label="Kategori"
          />
          
          <button
            className="w-full p-2 bg-yellow-300 text-white rounded-md hover:bg-yellow-400 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 min-h-[40px]"
            type="submit"
            disabled={isSubmitting || isNavigating}
          >
            {isSubmitting ? (
              <>
                <SpinningLoader size="small" color="white" />
                <span>Menambahkan...</span>
              </>
            ) : (
              <span>Tambah Produk</span>
            )}
          </button>
        </form>
      </main>

      {/* Success Popup */}
      {isSuccessPopupVisible && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-green-500 text-white p-4 rounded-lg shadow-lg z-50">
          <div className="flex items-center space-x-2">
            <i className="fas fa-check-circle" aria-hidden="true"></i>
            <p className="font-semibold">
              Produk berhasil ditambahkan!
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

export default TambahProdukPage;