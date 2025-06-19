import { MetaFunction, LoaderFunctionArgs, json } from "@remix-run/node";
import { useLoaderData, useNavigate, Link } from "@remix-run/react";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Loader untuk mengambil produk berdasarkan pencarian, kategori, dan pengurutan
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const searchQuery = url.searchParams.get("search") || ""; // Ambil query search
  const sortBy = url.searchParams.get("sort") || "relevan"; // Ambil parameter sort
  const category = url.searchParams.get("category") || ""; // Ambil kategori jika ada

  // Konfigurasi pengurutan
  let orderBy = {};
  if (sortBy === "terbaru") {
    orderBy = { createdAt: "desc" };
  } else if (sortBy === "termurah") {
    orderBy = { price: "asc" };
  } else if (sortBy === "termahal") {
    orderBy = { price: "desc" };
  }

  // Query pencarian
  const whereClause: {
    name: { contains: string; mode: "insensitive" };
    category?: { equals: string; mode: "insensitive" };
  } = {
    name: {
      contains: searchQuery,
      mode: "insensitive",
    },
    ...(category && {
      category: {
        equals: category,
        mode: "insensitive",
      },
    }),
  };

  // Fetch produk yang sesuai dengan pencarian, kategori, dan pengurutan
  const products = await prisma.product.findMany({
    where: {
      ...whereClause, // Kondisi tambahan jika ada
      isVisible: true,
    },
    orderBy: Object.keys(orderBy).length ? orderBy : { createdAt: "asc" },
    include: { images: true },
  });

  return json({ products, searchQuery, sortBy, category });
};

// Meta tags
export const meta: MetaFunction = () => {
  return [
    { title: "Thrift Ease - Search Products" },
    { name: "description", content: "Search thrift products easily." },
  ];
};

export default function SearchProduct() {
  const { products, searchQuery, sortBy, category } =
    useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const categories = [
    "Jaket",
    "Kemeja",
    "T-Shirt",
    "Celana",
    "Topi",
    "Sepatu",
    "Dress",
    "Rok",
  ]; // Daftar kategori

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-yellow-300 p-4 sticky top-0 w-full z-10">
        <div className="relative flex items-center justify-center">
          <button
            onClick={() => navigate("/")}
            className="absolute left-4 text-white text-xl"
          >
            <i className="fas fa-arrow-left"></i>
          </button>
          <form className="relative w-3/4" method="get">
            <i className="fas fa-search absolute top-1/2 left-4 transform -translate-y-1/2 text-gray-300"></i>
            <input
              type="text"
              name="search"
              defaultValue={searchQuery}
              placeholder="Cari produk"
              className="w-full p-2 pl-10 rounded-full border border-gray-300"
            />
          </form>
        </div>
      </header>

      {/* Kategori */}
      <section className="bg-gray-100 p-4">
        <div className="flex flex-wrap justify-center space-x-2 sm:space-x-4 mb-4">
          {categories.map((cat) => (
            <a
              key={cat}
              href={`?search=${searchQuery}&category=${cat}&sort=${sortBy}`}
              className={`${
                category === cat
                  ? "bg-yellow-300 text-white"
                  : "bg-white text-gray-600"
              } px-3 py-1 sm:px-4 sm:py-2 rounded-full text-sm sm:text-base shadow-md`}
            >
              {cat}
            </a>
          ))}
        </div>
      </section>

      {/* Urutan Produk */}
      <section className="p-4">
        <div className="flex flex-wrap justify-center space-x-2 sm:space-x-4 mb-4">
          <div className="px-2 sm:px-4 py-1 sm:py-2 text-xs sm:text-base">
            Urutkan:
          </div>
          <a
            href={`?search=${searchQuery}&category=${category}&sort=relevan`}
            className={`${
              sortBy === "relevan"
                ? "bg-yellow-300 text-white"
                : "text-gray-600"
            } px-2 sm:px-4 py-1 sm:py-2 rounded-full text-xs sm:text-base`}
          >
            Relevan
          </a>
          <a
            href={`?search=${searchQuery}&category=${category}&sort=terbaru`}
            className={`${
              sortBy === "terbaru"
                ? "bg-yellow-300 text-white"
                : "text-gray-600"
            } px-2 sm:px-4 py-1 sm:py-2 rounded-full text-xs sm:text-base`}
          >
            Terbaru
          </a>
          <a
            href={`?search=${searchQuery}&category=${category}&sort=termurah`}
            className={`${
              sortBy === "termurah"
                ? "bg-yellow-300 text-white"
                : "text-gray-600"
            } px-2 sm:px-4 py-1 sm:py-2 rounded-full text-xs sm:text-base`}
          >
            Termurah
          </a>
          <a
            href={`?search=${searchQuery}&category=${category}&sort=termahal`}
            className={`${
              sortBy === "termahal"
                ? "bg-yellow-300 text-white"
                : "text-gray-600"
            } px-2 sm:px-4 py-1 sm:py-2 rounded-full text-xs sm:text-base`}
          >
            Termahal
          </a>
        </div>
      </section>

      {/* Search Results */}
      <main className="flex-grow p-4 bg-gray-100">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {products.map((product) => (
            <Link
              to={`/detailproduk/?id=${product.id}`}
              key={product.id}
              className="bg-white p-2 sm:p-4 rounded-lg shadow-md text-xs sm:text-base hover:shadow-lg transition-shadow duration-200"
            >
              <div className="w-full h-48 flex items-center justify-center overflow-hidden rounded-md">
                <img
                  src={
                    product.images.length > 0
                      ? product.images[0].url
                      : "https://placehold.co/300x300?text=No+Image"
                  }
                  alt={product.name}
                  className="object-contain w-full h-full"
                />
              </div>
              <h2 className="text-gray-800 font-semibold mb-1 sm:mb-2 line-clamp-2">
                {product.name}
              </h2>
              <p className="text-gray-600 mb-1 sm:mb-2">
                Stock: {product.stock}
              </p>
              <p className="text-yellow-300 font-bold">
                Rp {product.price.toLocaleString()}
              </p>
            </Link>
          ))}
        </div>
        {products.length === 0 && (
          <p className="text-center text-gray-600 mt-4">
            Tidak ada produk yang ditemukan.
          </p>
        )}
      </main>
    </div>
  );
}
