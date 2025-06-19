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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const fileArray = Array.from(files);
      const previews: string[] = fileArray.map((file) =>
        URL.createObjectURL(file)
      );
      setImages((prevImages) => [...prevImages, ...fileArray]);
      setPreviewImages((prevPreviews) => [...prevPreviews, ...previews]);
    }
  };

  const removeImage = (index: number) => {
    setImages((prevImages) => prevImages.filter((_, i) => i !== index));
    setPreviewImages((prevPreviews) =>
      prevPreviews.filter((_, i) => i !== index)
    );
  };

  const handleNavigation = async () => {
    setIsNavigating(true);
    try {
      navigate("/admin/productslist");
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

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("name", name);
      formData.append("description", description);
      formData.append("size", size);
      formData.append("price", price);
      formData.append("stock", stock);
      formData.append("category", category);

      if (images.length > 0) {
        images.forEach((image) => formData.append("images[]", image));
      }

      const response = await fetch("/api/products", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        setSuccessPopupVisible(true);
        setTimeout(() => {
          setSuccessPopupVisible(false);
          navigate("/admin/productslist");
        }, 3000);
      } else {
        alert("Gagal menambah produk");
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      alert("Terjadi kesalahan saat menambah produk");
    } finally {
      setIsSubmitting(false);
    }
  };

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
              <div className="w-full max-w-md border-2 border-dashed border-gray-400 p-6 rounded-lg flex flex-col items-center justify-center">
                <input
                  type="file"
                  accept="image/*"
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

              <div className="grid grid-cols-3 gap-4 mt-4">
                {previewImages.map((src, index) => (
                  <div
                    key={index}
                    className="relative w-24 h-24 border rounded-lg overflow-hidden"
                  >
                    <img
                      src={src}
                      alt={`Preview ${index}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm shadow-md hover:bg-red-600 transition-colors duration-200 disabled:opacity-50"
                      disabled={isSubmitting || isNavigating}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <input
            type="text"
            placeholder="Nama Produk"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-2 border rounded-md focus:outline-none focus:border-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSubmitting || isNavigating}
          />
          
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Deskripsi Produk"
            className="w-full p-2 border rounded-md bg-white text-gray-500 resize-none h-24 focus:outline-none focus:border-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSubmitting || isNavigating}
          ></textarea>
          
          <div className="flex space-x-2">
            <input
              type="text"
              placeholder="Harga"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full p-2 border rounded-md focus:outline-none focus:border-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting || isNavigating}
            />
            <input
              type="text"
              placeholder="Ukuran"
              value={size}
              onChange={(e) => setSize(e.target.value)}
              className="w-full p-2 border rounded-md focus:outline-none focus:border-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting || isNavigating}
            />
            <input
              type="text"
              placeholder="Stok"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              className="w-full p-2 border rounded-md focus:outline-none focus:border-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting || isNavigating}
            />
          </div>
          
          <input
            type="text"
            placeholder="Kategori"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full p-2 border rounded-md focus:outline-none focus:border-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSubmitting || isNavigating}
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

      {isSuccessPopupVisible && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-yellow-300 text-white p-4 rounded-lg shadow-lg z-50">
          <p className="text-center font-semibold">
            Produk berhasil ditambahkan!
          </p>
        </div>
      )}
    </div>
  );
};

export default TambahProdukPage;