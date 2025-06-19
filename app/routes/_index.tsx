import {
  MetaFunction,
  ActionFunction,
  LoaderFunctionArgs,
  json,
  redirect,
} from "@remix-run/node";
import {
  Link,
  useLoaderData,
  useNavigate,
  useNavigation,
} from "@remix-run/react";
import { getSession } from "~/utils/session.server";
import { authenticator } from "~/utils/auth.server";
import { PrismaClient } from "@prisma/client";
import {
  SpinningLoader,
  SpinnerWithText,
  LoadingOverlay,
  DoubleRingSpinner,
  OrbitSpinner,
} from "../routes/components/SpinningLoader";
import { useState } from "react";

const prisma = new PrismaClient();

// Loader to fetch products and user info
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request);

  if (!user) {
    return redirect("/login");
  }

  const categoryScores = await prisma.searchScore.findMany({
    where: { userId: user.id },
    orderBy: { score: "desc" },
  });

  const products = await prisma.product.findMany({
    take: 100,
    orderBy: { createdAt: "asc" },
    include: { images: true },
    where: { isVisible: true },
  });

  const userCategories = categoryScores.map((cs) => cs.category);

  const sortedProducts = products.sort((a, b) => {
    const scoreA = userCategories.indexOf(a.category);
    const scoreB = userCategories.indexOf(b.category);

    if (scoreA !== -1 && scoreB !== -1) {
      return scoreA - scoreB;
    }
    if (scoreA !== -1) return -1;
    if (scoreB !== -1) return 1;
    return 0;
  });

  return json({ products: sortedProducts, username: user.name });
};

export const action: ActionFunction = async ({ request }) => {
  await getSession(request);
  return null;
};

export const meta: MetaFunction = () => {
  return [
    { title: "Thrift Ease" },
    { name: "description", content: "Welcome to Remix!" },
  ];
};

export default function Index() {
  const navigation = useNavigation();
  const navigate = useNavigate();
  const [imageLoadingStates, setImageLoadingStates] = useState<{
    [key: string]: boolean;
  }>({});
  const [categoryLoading, setCategoryLoading] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  // Cek apakah sedang dalam proses loading
  const isPageLoading =
    navigation.state === "loading" || navigation.state === "submitting";

  const { products } = useLoaderData<typeof loader>();

  const handleSearchClick = () => {
    setSearchLoading(true);
    navigate("/search");
  };

  const handleCategoryClick = (category: string) => {
    setCategoryLoading(category);
    navigate(`/searchproduct?category=${category}`);
  };

  const handleFooterNavigation = (path: string) => {
    navigate(path);
  };

  const handleKeyDown = (event: React.KeyboardEvent, callback: () => void) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      callback();
    }
  };

  const handleImageLoad = (productId: string) => {
    setImageLoadingStates((prev) => ({
      ...prev,
      [productId]: false,
    }));
  };

  return (
    <>
      {/* Loading Overlay untuk page loading */}
      <LoadingOverlay
        isVisible={isPageLoading}
        text="Memuat halaman..."
        blur={true}
      />

      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <header className="bg-yellow-300 p-4 sticky top-0 w-full z-10">
          <div className="flex items-center justify-between relative">
            <div className="mx-auto w-3/4">
              <div className="relative">
                <i className="fas fa-search absolute top-1/2 left-4 transform -translate-y-1/2 text-gray-400"></i>
                <input
                  type="text"
                  placeholder="Cari"
                  className="w-full p-2 pl-10 pr-12 rounded-full border border-gray-300 cursor-pointer transition-all duration-200 hover:shadow-md focus:ring-2 focus:ring-yellow-300"
                  onClick={handleSearchClick}
                  onKeyDown={(e) => handleKeyDown(e, handleSearchClick)}
                  readOnly
                  role="button"
                  tabIndex={0}
                  aria-label="Buka halaman pencarian"
                />
                {searchLoading && (
                  <div className="absolute top-1/2 right-4 transform -translate-y-1/2">
                    <SpinningLoader size="small" color="yellow" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <div className="pt-20 bg-gray-100 p-4 flex justify-center">
          <div className="bg-white p-4 rounded-lg shadow-md flex items-center justify-between w-full md:w-1/2 transform transition-all duration-300 ">
            <img
              src="/app/foto/Group 211.png"
              alt="Man in checkered shirt"
              className="rounded-full w-16 h-16 transition-opacity duration-300"
            />
            <h1 className="text-xl font-bold text-center">
              Jelajahi Gaya Thrift Terbaik
            </h1>
            <img
              src="/app/foto/Group 210.png"
              alt="Woman in denim jacket"
              className="rounded-full w-16 h-16 transition-opacity duration-300"
            />
          </div>
        </div>

        {/* Category Section */}
        <div className="bg-gray-100 p-4 flex justify-center">
          <div className="w-full md:w-1/2">
            <h2 className="text-xl font-bold mb-4 text-center">KATEGORI</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {[
                "Jaket",
                "Kemeja",
                "T-Shirt",
                "Celana",
                "Topi",
                "Sepatu",
                "Dress",
                "Rok",
              ].map((category, index) => (
                <button
                  key={index}
                  onClick={() => handleCategoryClick(category)}
                  className="bg-white p-4 rounded-lg shadow-md flex flex-col items-center hover:bg-gray-50 transition-all duration-300 focus:ring-2 focus:ring-yellow-300 transform hover:scale-105 hover:shadow-lg relative"
                  aria-label={`Pilih kategori ${category}`}
                  disabled={categoryLoading === category}
                >
                  <img
                    src={`/app/foto/${category} 1.png`}
                    alt={`Ikon ${category}`}
                    className="w-12 h-12 sm:w-16 sm:h-16 mb-2 transition-transform duration-200"
                  />
                  <span className="text-sm sm:text-base">{category}</span>

                  {/* Loading spinner overlay */}
                  {categoryLoading === category && (
                    <div className="absolute inset-0 bg-white bg-opacity-80 flex items-center justify-center rounded-lg">
                      <DoubleRingSpinner size="medium" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Recommendations Section */}
        <div className="bg-gray-100 p-4">
          <h2 className="text-xl font-bold mb-4 text-center">REKOMENDASI</h2>

          {products.length === 0 ? (
            <div className="flex justify-center py-12">
              <SpinnerWithText
                text="Memuat rekomendasi produk..."
                size="large"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {products.map((product) => (
                <Link
                  to={`detailproduk/?id=${product.id}`}
                  key={product.id}
                  className="bg-white p-2 sm:p-4 rounded-lg shadow-md text-xs sm:text-base hover:shadow-xl transition-all transform hover:scale-105 hover:-translate-y-1"
                  aria-label={`Lihat detail produk ${product.name}`}
                >
                  <div className="w-full h-48 flex items-center justify-center overflow-hidden rounded-md relative bg-gray-50">
                    {imageLoadingStates[product.id] && (
                      <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
                        <OrbitSpinner size="medium" />
                      </div>
                    )}
                    <img
                      src={
                        product.images.length > 0
                          ? product.images[0].url
                          : "https://placehold.co/300x300?text=No+Image"
                      }
                      alt={product.name}
                      className={`object-contain w-full h-full transition-opacity duration-500 ${
                        imageLoadingStates[product.id]
                          ? "opacity-0"
                          : "opacity-100"
                      }`}
                      onLoad={() => handleImageLoad(product.id)}
                      onError={() => handleImageLoad(product.id)}
                    />
                  </div>
                  <h2 className="text-gray-800 font-semibold mb-1 sm:mb-2 line-clamp-2 mt-2">
                    {product.name}
                  </h2>
                  <p className="text-gray-600 mb-1 sm:mb-2 text-xs">
                    Stock: {product.stock}
                  </p>
                  <p className="text-yellow-400 font-bold">
                    Rp {product.price.toLocaleString()}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="bottom-0 w-full bg-yellow-300 p-4 flex justify-around items-center z-10 sticky">
          <button
            className="flex flex-col items-center transition-transform duration-200 hover:scale-110"
            onClick={() => handleFooterNavigation("/")}
            aria-label="Navigasi ke Beranda"
          >
            <i className="fas fa-home text-2xl text-white"></i>
            <span className="text-white text-sm font-bold">Beranda</span>
          </button>
          <button
            className="flex flex-col items-center transition-transform duration-200 hover:scale-110"
            onClick={() => handleFooterNavigation("/cart")}
            aria-label="Navigasi ke Keranjang"
          >
            <i className="fas fa-shopping-cart text-2xl text-white"></i>
            <span className="text-white text-sm font-bold">Keranjang</span>
          </button>
          <button
            className="flex flex-col items-center transition-transform duration-200 hover:scale-110"
            onClick={() => handleFooterNavigation("/profile")}
            aria-label="Navigasi ke Profil Saya"
          >
            <i className="fas fa-user text-2xl text-white"></i>
            <span className="text-white text-sm font-bold">Saya</span>
          </button>
        </footer>
      </div>
    </>
  );
}
