import { json, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { PrismaClient } from "@prisma/client";
import { authenticator } from "~/utils/auth.server";

const prisma = new PrismaClient();

// Loader function to fetch transaction data
export async function loader({ request }: LoaderFunctionArgs) {
  const user = await authenticator.isAuthenticated(request);

  if (!user) {
    return json({ error: "Gagal memuat ID user" }, { status: 401 });
  }

  try {
    const transactions = await prisma.payment.findMany({
      where: {
        order: {
          userId: user.id,
        },
      },
      include: {
        order: {
          include: {
            items: {
              include: {
                product: {
                  select: {
                    name: true,
                    images: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (transactions.length === 0) {
      return json({ transactions: [] });
    }

    return json({ transactions });
  } catch (error) {
    console.error(error);
    return json({ error: "Gagal memuat riwayat transaksi" }, { status: 500 });
  }
}

type TransactionItem = {
  id: number;
  amount: number;
  status: string;
  createdAt: string | Date;
  order: {
    id: number;
    userId: number;
    items: Array<{
      id: number;
      product: {
        name: string;
        images: string[];
      };
    }>;
  };
};

type LoaderData = {
  transactions?: Array<TransactionItem>;
  error?: string;
};

export default function RiwayatTransaksiPage() {
    const navigate = useNavigate();
    const { transactions = [], error } = useLoaderData<LoaderData>();
  
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
            Riwayat Transaksi
          </h1>
        </header>
  
        {/* Content */}
        {transactions.length === 0 ? (
          <div className="flex justify-center items-center h-full px-4">
            <p className="text-base sm:text-lg text-gray-500 text-center">
              Tidak ada riwayat transaksi.
            </p>
          </div>
        ) : (
          <div className="px-4 lg:px-6">
            {transactions.map((transaction) => (
              <div
                key={transaction.id}
                className="bg-white shadow-md rounded-lg mb-6 p-4 sm:p-6 border border-gray-200"
              >
                <div className="flex justify-between items-center">
                  <h2 className="text-base sm:text-xl font-bold">
                    Transaksi #{transaction.id}
                  </h2>
                  <span className="text-xs sm:text-sm text-gray-500">
                    {new Date(transaction.createdAt).toLocaleDateString()}
                  </span>
                </div>
  
                {/* Uang Section */}
                <div className="flex justify-between items-center mt-4 bg-gray-50 p-3 sm:p-4 rounded-lg shadow-sm border">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 lg:w-10 lg:h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <i className="fas fa-money-bill-wave text-green-600 text-lg"></i>
                    </div>
                    <span className="text-sm sm:text-base font-medium text-gray-800">
                      Total Transaksi
                    </span>
                  </div>
                  <p className="text-sm sm:text-lg font-bold text-gray-900">
                    Rp {transaction.amount.toLocaleString()}
                  </p>
                </div>
  
                <div className="mt-4 flex justify-between items-center">
                  <p
                    className={`py-1 px-3 rounded-lg text-xs sm:text-sm font-semibold ${
                      transaction.status === "SUCCESS"
                        ? "bg-green-100 text-green-700"
                        : transaction.status === "PENDING"
                        ? "bg-yellow-300 text-black"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {transaction.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
  