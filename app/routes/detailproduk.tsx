import { LoaderFunction, ActionFunction, json } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { PrismaClient } from "@prisma/client";
import { authenticator } from "~/utils/auth.server";
import React, { useState } from "react";

const prisma = new PrismaClient();

export const loader: LoaderFunction = async ({ request }) => {
  const user = await authenticator.isAuthenticated(request);

  if (!user) {
    throw new Response("User is not authenticated", { status: 401 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    throw new Response("Product ID is required", { status: 400 });
  }

  const product = await prisma.product.findUnique({
    where: { id: String(id) },
    include: { images: true },
  });

  if (!product) {
    throw new Response("Product not found", { status: 404 });
  }

  return json({ product, userId: user.id });
};

export const action: ActionFunction = async ({ request }) => {
  const user = await authenticator.isAuthenticated(request);

  if (!user) {
    throw new Response("User is not authenticated", { status: 401 });
  }

  const formData = await request.formData();
  const productId = formData.get("productId") as string;

  if (!productId) {
    return json({ error: "Product ID is required" }, { status: 400 });
  }

  // Get product to check stock
  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product) {
    return json({ error: "Produk tidak ditemukan" }, { status: 404 });
  }

  let cart = await prisma.cart.findUnique({
    where: { userId: user.id },
  });

  if (!cart) {
    cart = await prisma.cart.create({
      data: { userId: user.id },
    });
  }

  const existingCartItem = await prisma.cartItem.findFirst({
    where: { cartId: cart.id, productId },
  });

  if (existingCartItem) {
    // If item exists, check if we can add more (only if quantity < stock)
    if (existingCartItem.quantity < product.stock) {
      // Update quantity normally
      await prisma.cartItem.update({
        where: { id: existingCartItem.id },
        data: { 
          quantity: existingCartItem.quantity + 1,
          updatedAt: new Date() // Update timestamp to sort to top
        },
      });
    } else {
      // Item exists but stock is full, just update timestamp to move to top
      await prisma.cartItem.update({
        where: { id: existingCartItem.id },
        data: { 
          updatedAt: new Date() // Only update timestamp to sort to top
        },
      });
    }
  } else {
    // Create new cart item
    await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId,
        quantity: 1,
      },
    });
  }

  return json({ success: true });
};

const DetailProdukPage = () => {
  const { product } = useLoaderData<typeof loader>();
  const [feedback, setFeedback] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const navigate = useNavigate();
  const [showFeedback, setShowFeedback] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nextImage = () => {
    setCurrentIndex((prevIndex) =>
      prevIndex === product.images.length - 1 ? 0 : prevIndex + 1
    );
  };

  const prevImage = () => {
    setCurrentIndex((prevIndex) =>
      prevIndex === 0 ? product.images.length - 1 : prevIndex - 1
    );
  };

  const handleAddToCart = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent multiple submissions
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    
    const formData = new FormData(e.currentTarget as HTMLFormElement);

    try {
      const response = await fetch(window.location.href, {
        method: "POST",
        body: formData,
      });

      // Check if response is ok first
      if (response.ok) {
        setFeedback("Produk berhasil ditambahkan ke keranjang!");
      } else {
        // Try to parse JSON for error message
        try {
          const result = await response.json();
          setFeedback(result.error || "Terjadi kesalahan.");
        } catch (jsonError) {
          // If JSON parsing fails, use status-based message
          if (response.status === 400) {
            setFeedback("Data tidak valid.");
          } else if (response.status === 401) {
            setFeedback("Anda perlu login terlebih dahulu.");
          } else if (response.status === 404) {
            setFeedback("Produk tidak ditemukan.");
          } else {
            setFeedback("Terjadi kesalahan pada server.");
          }
        }
      }
      
      setShowFeedback(true);
      setTimeout(() => {
        setShowFeedback(false);
      }, 3000);
    } catch (error) {
      console.error("Network error:", error);
      setFeedback("Terjadi kesalahan jaringan.");
      setShowFeedback(true);
      setTimeout(() => {
        setShowFeedback(false);
      }, 3000);
    } finally {
      // Re-enable button after a short delay to prevent spam
      setTimeout(() => {
        setIsSubmitting(false);
      }, 1000);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-white relative">
      {/* Overlay feedback - Fixed z-index issue */}
      {showFeedback && (
        <div className="fixed top-4 left-0 w-full flex justify-center items-center z-[60] pointer-events-none">
          <div className={`px-4 py-2 rounded shadow-lg transition-opacity duration-300 ${
            feedback.includes('berhasil') 
              ? 'bg-green-200 text-green-800' 
              : 'bg-red-200 text-red-800'
          }`}>
            {feedback}
          </div>
        </div>
      )}

      <header className="sticky top-0 flex justify-between items-center p-4 bg-white z-50 shadow">
        <button
          onClick={() => navigate(-1)}
          className="w-8 h-8 lg:w-10 lg:h-10 bg-yellow-300 rounded-full flex items-center justify-center"
        >
          <i className="fas fa-arrow-left"></i>
        </button>
        <div className="relative flex space-x-4">
          <button onClick={() => navigate("/cart")} className="text-yellow-400">
            <i className="fas fa-shopping-cart"></i>
          </button>
        </div>
      </header>

      <main className="flex-grow px-6 py-4">
        <div className="relative flex justify-center items-center py-4">
          <button
            onClick={prevImage}
            className="absolute left-0 text-black p-2"
          >
            <i className="fas fa-chevron-left"></i>
          </button>
          <img
            src={
              product.images.length > 0
                ? product.images[currentIndex]?.url
                : "https://placehold.co/300x300?text=No+Image"
            }
            alt={`Product ${currentIndex + 1}`}
            className="w-56 h-56 md:w-64 md:h-64 object-cover"
          />
          <button
            onClick={nextImage}
            className="absolute right-0 text-black p-2"
          >
            <i className="fas fa-chevron-right"></i>
          </button>
        </div>

        <div className="flex justify-center space-x-2 mb-4">
          {product.images.map((_: { url: string }, index: number) => (
            <div
              key={index}
              className={`w-3 h-3 rounded-full ${
                index === currentIndex ? "bg-yellow-300" : "bg-gray-300"
              }`}
            ></div>
          ))}
        </div>

        <div className="bg-gray-100 p-6">
          <h1 className="text-md sm:text-lg md:text-xl font-semibold">
            {product.name}
          </h1>
          <p className="text-xs sm:text-sm md:text-base text-gray-500 mt-2">
            Size: {product.size || "N/A"}
          </p>
          <div className="flex justify-between items-center mt-3">
            <span className="text-yellow-500 text-md sm:text-lg md:text-xl font-bold">
              Rp {product.price.toLocaleString()}
            </span>
            <span className="text-gray-500 text-xs sm:text-sm md:text-base">
              Stok: {product.stock}
            </span>
          </div>
        </div>

        <div className="mt-6">
          <h2 className="text-sm sm:text-md md:text-lg font-bold">
            DETAIL PRODUK
          </h2>
          <ul className="list-disc list-inside text-xs sm:text-sm md:text-base text-gray-700 mt-2">
            {product.description.split("\n").map((detail: string, index: number) => (
              <li key={index}>{detail}</li>
            ))}
          </ul>
        </div>
      </main>

      <footer className="sticky bottom-0 bg-yellow-300 flex justify-center items-center shadow z-40">
        <form onSubmit={handleAddToCart}>
          <input type="hidden" name="productId" value={product.id} />
          <button
            type="submit"
            disabled={isSubmitting || product.stock === 0}
            className={`text-black text-xs sm:text-sm font-bold py-3 px-6 rounded-full flex flex-col items-center space-y-1 transition-opacity ${
              isSubmitting || product.stock === 0 
                ? 'opacity-50 cursor-not-allowed' 
                : 'hover:opacity-80'
            }`}
          >
            <div className="border-2 border-black rounded-lg pt-1 pb-1 pl-3 pr-3">
              {isSubmitting ? (
                <i className="fas fa-spinner fa-spin"></i>
              ) : (
                <i className="fas fa-plus"></i>
              )}
            </div>
            <span>
              {product.stock === 0 
                ? 'Stok Habis' 
                : isSubmitting 
                  ? 'Menambahkan...' 
                  : 'Tambahkan ke Keranjang'
              }
            </span>
          </button>
        </form>
      </footer>
    </div>
  );
};

export default DetailProdukPage;