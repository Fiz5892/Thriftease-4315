import {
  ActionFunction,
  LoaderFunction,
  json,
  redirect,
} from "@remix-run/node";
import { Form, useLoaderData, useNavigate, Link } from "@remix-run/react";
import { PrismaClient } from "@prisma/client";
import { authenticator } from "~/utils/auth.server";

const prisma = new PrismaClient();

// Loader untuk rekomendasi produk
export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const user = await authenticator.isAuthenticated(request);

  if (!user) {
    return redirect("/login");
  }

  const searchQuery = url.searchParams.get("search") || "";
  const category = url.searchParams.get("category") || "";
  const sortBy = url.searchParams.get("sort") || "Relevan";

  // Jika tidak ada pencarian atau kategori, kembalikan hasil kosong
  if (!searchQuery.trim() && !category) {
    return json({
      products: [],
      username: user.name,
      searchQuery,
      category,
      sortBy,
    });
  }

  // Ambil skor kategori pengguna
  const categoryScores = await prisma.searchScore.findMany({
    where: { userId: user.id },
    orderBy: { score: "desc" },
  });

  const userCategories = categoryScores.map((cs) => cs.category);

  // Konfigurasi pengurutan
  let orderBy = {};
  if (sortBy === "Terbaru") {
    orderBy = { createdAt: "desc" };
  } else if (sortBy === "Termurah") {
    orderBy = { price: "asc" };
  } else if (sortBy === "Termahal") {
    orderBy = { price: "desc" };
  }

  // Query pencarian
  const whereClause: {
    isVisible: boolean;
    name?: { contains: string; mode: "insensitive" };
    category?: { equals: string; mode: "insensitive" };
  } = {
    isVisible: true,
    ...(searchQuery.trim() && {
      name: { contains: searchQuery, mode: "insensitive" as const },
    }),
    ...(category && {
      category: { equals: category, mode: "insensitive" as const },
    }),
  };

  const products = await prisma.product.findMany({
    where: whereClause,
    orderBy: Object.keys(orderBy).length ? orderBy : { createdAt: "asc" },
    include: { images: true },
    take: 100,
  });

  // Urutkan produk berdasarkan kategori skor tertinggi
  const sortedProducts = products.sort((a, b) => {
    const scoreA =
      userCategories.indexOf(a.category) !== -1
        ? userCategories.indexOf(a.category)
        : Infinity;
    const scoreB =
      userCategories.indexOf(b.category) !== -1
        ? userCategories.indexOf(b.category)
        : Infinity;

    return scoreA - scoreB;
  });

  return json({
    products: sortedProducts,
    username: user.name,
    searchQuery,
    category,
    sortBy,
  });
};

// Action untuk pencarian
export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const searchQuery = formData.get("search")?.toString() || "";
  const user = await authenticator.isAuthenticated(request);

  if (!user) {
    return redirect("/login");
  }

  const category = determineCategory(searchQuery);
  await prisma.search.create({
    data: { userId: user.id, query: searchQuery },
  });

  if (category) {
    await updateCategoryScore(user.id, category);
  }

  return redirect(`/search?search=${searchQuery}`);
};

// Utilitas: Update skor kategori
async function updateCategoryScore(userId: string, category: string) {
  const searchScore = await prisma.searchScore.findFirst({
    where: { userId, category },
  });

  if (searchScore) {
    await prisma.searchScore.update({
      where: { id: searchScore.id },
      data: { score: { increment: 1 } },
    });
  } else {
    await prisma.searchScore.create({
      data: { userId, category, score: 1 },
    });
  }
}

// Utilitas: Tentukan kategori dari query pencarian
function determineCategory(query: string): string {
  if (query.toLowerCase().includes("baju")) return "Baju";
  if (query.toLowerCase().includes("celana")) return "Celana";
  if (query.toLowerCase().includes("sepatu")) return "Sepatu";
  if (query.toLowerCase().includes("jaket")) return "Jaket";
  if (query.toLowerCase().includes("topi")) return "Topi";
  if (query.toLowerCase().includes("kaos")) return "T-Shirt";
  if (query.toLowerCase().includes("dress")) return "Dress";
  if (query.toLowerCase().includes("rok")) return "Rok";
  if (query.toLowerCase().includes("kemeja")) return "Kemeja";

  return "Lainnya";
}

// Komponen React untuk menampilkan data
export default function Search() {
  const { products, searchQuery, category, sortBy } = useLoaderData<{
    products: {
      id: string;
      name: string;
      price: number;
      stock: string;
      category: string;
      images: { url: string }[];
    }[];
    username: string;
    searchQuery: string;
    category: string;
    sortBy: string;
  }>();

  const categories = [
    "Jaket",
    "Kemeja",
    "T-Shirt",
    "Celana",
    "Topi",
    "Sepatu",
    "Dress",
    "Rok",
  ];
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-yellow-300 p-4 sticky top-0 w-full z-10">
        <div className="relative flex items-center justify-center">
          <button
            onClick={() => navigate("/")}
            className="absolute left-4 text-white text-xl"
          >
            <i className="fas fa-arrow-left"></i>
          </button>
          <Form method="post" action="/search" className="relative w-3/4">
            <input
              type="text"
              name="search"
              placeholder="Cari produk..."
              defaultValue={searchQuery || ""}
              className="w-full p-2 pl-10 rounded-full border border-gray-300"
            />
            <i className="fas fa-search absolute top-1/2 left-4 transform -translate-y-1/2 text-gray-300"></i>
          </Form>
        </div>
      </header>

      <section className="bg-gray-100 p-4">
        <div className="flex flex-wrap justify-center space-x-2 sm:space-x-4 mb-4">
          {categories.map((cat) => (
            <Link
              key={cat}
              to={`?search=${searchQuery}&category=${cat}&sort=${sortBy}`}
              className={`px-4 py-2 ${
                category === cat ? "bg-yellow-300 text-white" : "bg-gray-200"
              } rounded-full`}
            >
              {cat}
            </Link>
          ))}
        </div>
      </section>

      <section className="p-4">
        <div className="flex flex-wrap justify-center space-x-2 sm:space-x-4 mb-4">
          <div className="px-2 sm:px-4 py-1 sm:py-2 text-xs sm:text-base">
            Urutkan:
          </div>
          {["Relevan", "Terbaru", "Termurah", "Termahal"].map((sort) => (
            <Link
              key={sort}
              to={`?search=${searchQuery}&category=${category}&sort=${sort}`}
              className={`px-4 py-2 ${
                sortBy === sort ? "bg-yellow-300 text-white" : "bg-gray-200"
              } px-2 sm:px-4 py-1 sm:py-2 rounded-full text-xs sm:text-base`}
            >
              {sort}
            </Link>
          ))}
        </div>
      </section>

      <main className="flex-grow p-4 bg-gray-100">
        {searchQuery.trim() === "" && (
          <p className="text-center text-gray-600 mt-4">
            Silahkan mencari produk menggunakan kotak pencarian di atas.
          </p>
        )}
        {searchQuery.trim() !== "" && products.length === 0 && (
          <p className="text-center text-gray-600 mt-4">
            Tidak ada produk yang ditemukan untuk pencarian &quot;
            <b>{searchQuery}</b>&quot;.
          </p>
        )}
        {products.length > 0 && (
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
        )}
      </main>
    </div>
  );
}
