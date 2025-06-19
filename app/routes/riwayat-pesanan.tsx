import { json, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { PrismaClient } from "@prisma/client";
import { authenticator } from "~/utils/auth.server";

const prisma = new PrismaClient();

// Loader function to fetch order data
export async function loader({ request }: LoaderFunctionArgs) {
  const user = await authenticator.isAuthenticated(request);

  if (!user) {
    return json({ error: "Gagal memuat ID user" }, { status: 401 });
  }

  try {
    const orders = await prisma.order.findMany({
      where: {
        userId: user.id, // Filter pesanan berdasarkan userId
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                name: true,
                images: true, // Memuat gambar produk
                size: true, // Memuat ukuran produk
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" }, // Sort by newest order
    });

    if (orders.length === 0) {
      return json({ orders: [] });
    }

    return json({ orders });
  } catch (error) {
    console.error(error);
    return json({ error: "Gagal memuat riwayat pesanan" }, { status: 500 });
  }
}

type Product = {
  name: string;
  images: { url: string }[];
  size?: string | null;
};

type OrderItem = {
  id: string;
  quantity: number;
  product: Product;
};

type Order = {
  id: string;
  createdAt: string | Date;
  totalAmount: number;
  status: string;
  items: OrderItem[];
};

type LoaderData = {
  orders: Order[];
  error?: string;
};

export default function RiwayatPesananPage() {
  const navigate = useNavigate();
  const { orders = [], error } = useLoaderData<LoaderData>();

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen px-4">
        <h1 className="text-lg sm:text-2xl font-bold text-red-500 text-center">
          Terjadi Kesalahan
        </h1>
        <p className="text-sm sm:text-base text-gray-600 text-center">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      {/* Header */}
      <header className="relative flex items-center justify-between border-b pb-2 lg:pb-4 mb-4 lg:mb-6 w-full px-4 lg:px-8 bg-white pt-4">
        <button
          onClick={() => navigate(-1)}
          className="w-8 h-8 lg:w-10 lg:h-10 bg-yellow-300 rounded-full flex items-center justify-center"
        >
          <i className="fas fa-arrow-left"></i>
        </button>
        <h1 className="absolute left-1/2 transform -translate-x-1/2 text-lg sm:text-xl lg:text-2xl font-bold">
          Pesanan Saya
        </h1>
      </header>

      {/* Content */}
      {orders.length === 0 ? (
        <div className="flex justify-center items-center h-full px-4">
          <p className="text-base sm:text-lg text-gray-500 text-center">
            Tidak ada riwayat pesanan.
          </p>
        </div>
      ) : (
        <div className="px-4 lg:px-6">
          {orders.map((order) => (
            <div
              key={order.id}
              className="bg-white shadow-md rounded-lg mb-6 p-4 sm:p-6 border border-gray-200"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-base sm:text-xl font-bold">
                  Pesanan #{order.id}
                </h2>
                <span className="text-xs sm:text-sm text-gray-500">
                  {new Date(order.createdAt).toLocaleDateString()}
                </span>
              </div>
              <ul className="mt-4 space-y-4">
                {order.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center space-x-4 bg-gray-50 p-3 sm:p-4 rounded-lg shadow-sm border"
                  >
                    <img
                      src={
                        item.product.images[0]?.url ||
                        "https://placehold.co/100x100"
                      }
                      alt={item.product.name}
                      className="w-12 h-12 sm:w-16 sm:h-16 object-cover rounded-md"
                    />
                    <div className="flex-1">
                      <h3 className="text-sm sm:text-lg font-semibold">
                        {item.product.name}
                      </h3>
                      {item.product.size && (
                        <p className="text-xs sm:text-sm text-gray-600">
                          Ukuran: {item.product.size}
                        </p>
                      )}
                      <p className="text-xs sm:text-sm text-gray-600">
                        Jumlah: {item.quantity} pcs
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex justify-between items-center">
                <p className="text-sm sm:text-base text-gray-800">
                  <strong>Total:</strong> Rp{" "}
                  {order.totalAmount.toLocaleString()}
                </p>
                <span
                  className={`py-1 px-3 rounded-lg text-xs sm:text-sm font-semibold ${
                    order.status === "Selesai"
                      ? "bg-green-100 text-green-700"
                      : "bg-yellow-300 text-black"
                  }`}
                >
                  {order.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
