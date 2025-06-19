import { json } from "@remix-run/node";
import {
  useLoaderData,
  useNavigate,
  useSearchParams,
  useNavigation,
} from "@remix-run/react";
import { PrismaClient, PaymentStatus } from "@prisma/client";
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { format } from "date-fns";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import { useState, useEffect } from "react";
import {
  SpinningLoader,
  LoadingOverlay,
  DoubleRingSpinner,
} from "../routes/components/SpinningLoader";

// Extend jsPDF type to include autoTable
declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: {
      startY?: number;
      head?: string[][];
      body?: string[][];
      theme?: string;
      styles?: Record<string, unknown>;
      headStyles?: Record<string, unknown>;
      bodyStyles?: Record<string, unknown>;
      columnStyles?: Record<string, Record<string, unknown>>;
      margin?: { top?: number; right?: number; bottom?: number; left?: number };
      pageBreak?: string;
      rowPageBreak?: string;
      tableWidth?: number | string;
      showHead?: boolean;
      showFoot?: boolean;
      tableLineWidth?: number;
      tableLineColor?: string | number[];
    }) => void;
    lastAutoTable: {
      finalY: number;
    };
  }
}

// Prisma Client
const prisma = new PrismaClient();

// Register Chart.js components
ChartJS.register(
  Title,
  Tooltip,
  Legend,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement
);

// Type definitions
interface DailyData {
  date: string;
  count: number;
}

interface LoaderData {
  totalTransactions: number;
  totalOrders: number;
  totalIncome: number;
  dailyOrders: DailyData[];
  dailyTransactions: DailyData[];
}

interface GroupedData {
  [key: string]: { count: number };
}

interface DataItem {
  createdAt: Date;
  _count: { id: number };
}

const groupByDate = (data: DataItem[]): DailyData[] => {
  const grouped: GroupedData = {};
  data.forEach((item) => {
    const dateKey = format(new Date(item.createdAt), "yyyy-MM-dd");
    if (!grouped[dateKey]) {
      grouped[dateKey] = { count: 0 };
    }
    grouped[dateKey].count += item._count.id;
  });

  // Convert grouped object to sorted array
  return Object.entries(grouped)
    .map(([date, { count }]) => ({ date, count }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // Sort by date ascending
};

// Loader function to fetch data
export const loader = async ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  const startDate = url.searchParams.get("startDate");
  const endDate = url.searchParams.get("endDate");

  const whereFilter =
    startDate && endDate
      ? { createdAt: { gte: new Date(startDate), lte: new Date(endDate) } }
      : {};
  const successFilter = { status: PaymentStatus.SUCCESS };

  const totalTransactions = await prisma.payment.count({
    where: { ...whereFilter, ...successFilter },
  });

  const totalIncome = await prisma.payment.aggregate({
    _sum: { amount: true },
    where: { ...whereFilter, ...successFilter },
  });

  const orders = await prisma.order.findMany({
    where: {
      ...whereFilter,
      payment: { status: PaymentStatus.SUCCESS },
    },
    select: { createdAt: true, id: true },
  });

  const transactions = await prisma.payment.findMany({
    where: { ...whereFilter, ...successFilter },
    select: { createdAt: true, id: true },
  });

  const dailyOrders = groupByDate(
    orders.map((order) => ({ createdAt: order.createdAt, _count: { id: 1 } }))
  );

  const dailyTransactions = groupByDate(
    transactions.map((transaction) => ({
      createdAt: transaction.createdAt,
      _count: { id: 1 },
    }))
  );

  return json({
    totalTransactions,
    totalOrders: orders.length,
    totalIncome: totalIncome._sum.amount || 0,
    dailyOrders,
    dailyTransactions,
  });
};

// Admin Dashboard Component
const AdminDashboard = () => {
  const {
    totalTransactions,
    totalOrders,
    totalIncome,
    dailyOrders,
    dailyTransactions,
  } = useLoaderData<LoaderData>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigation = useNavigation();

  // Loading states
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // Check if page is loading
  const isPageLoading = navigation.state === "loading";
  const isSubmitting = navigation.state === "submitting";

  // Handle initial loading state
  useEffect(() => {
    // Simulate initial data processing time
    const timer = setTimeout(() => {
      setIsInitialLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  const ordersData = {
    labels: dailyOrders.map((order) => order.date),
    datasets: [
      {
        label: "Jumlah Pesanan",
        data: dailyOrders.map((order) => order.count),
        backgroundColor: "rgba(75, 192, 192, 0.2)",
        borderColor: "rgba(75, 192, 192, 1)",
        borderWidth: 1,
      },
    ],
  };

  const transactionsData = {
    labels: dailyTransactions.map((transaction) => transaction.date),
    datasets: [
      {
        label: "Jumlah Transaksi",
        data: dailyTransactions.map((transaction) => transaction.count),
        backgroundColor: "rgba(255, 99, 132, 0.2)",
        borderColor: "rgba(255, 99, 132, 1)",
        borderWidth: 1,
      },
    ],
  };

  const generatePDF = async () => {
    setIsGeneratingPDF(true);

    try {
      // Add a small delay to show the loading state
      await new Promise((resolve) => setTimeout(resolve, 500));

      const doc = new jsPDF();

      // Judul dokumen
      doc.setFontSize(18);
      doc.text("Laporan Dashboard Admin ThriftEase", 10, 10);

      // Rentang waktu
      const startDate = searchParams.get("startDate") || "Semua waktu";
      const endDate = searchParams.get("endDate") || "Semua waktu";
      doc.setFontSize(12);
      doc.text(`Rentang Waktu: ${startDate} - ${endDate}`, 10, 20);

      // Statistik utama
      doc.text(`Total Pemasukan: Rp. ${totalIncome.toLocaleString()}`, 10, 30);
      doc.text(`Total Transaksi: ${totalTransactions}`, 10, 40);
      doc.text(`Total Pesanan: ${totalOrders}`, 10, 50);

      // Data detail pesanan harian
      doc.setFontSize(14);
      doc.text("Detail Pesanan Harian", 10, 60);
      doc.autoTable({
        startY: 65,
        head: [["Tanggal", "Jumlah Pesanan"]],
        body: dailyOrders.map((order) => [order.date, order.count.toString()]),
      });

      // Data detail transaksi harian
      const transactionsStartY = doc.lastAutoTable.finalY + 10;
      doc.setFontSize(14);
      doc.text("Detail Transaksi Harian", 10, transactionsStartY);
      doc.autoTable({
        startY: transactionsStartY + 5,
        head: [["Tanggal", "Jumlah Transaksi"]],
        body: dailyTransactions.map((transaction) => [
          transaction.date,
          transaction.count.toString(),
        ]),
      });

      // Unduh PDF
      doc.save("Laporan-Dashboard-Admin.pdf");
    } catch (error) {
      console.error("Error generating PDF:", error);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleFilter = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const startDate = form.get("startDate") as string | null;
    const endDate = form.get("endDate") as string | null;

    const params: Record<string, string> = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;

    setSearchParams(params);
  };

  // Show loading overlay during initial loading
  if (isInitialLoading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <LoadingOverlay
          isVisible={true}
          text="Memuat dashboard..."
          blur={true}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Loading Overlay untuk page loading dan submitting */}
      <LoadingOverlay
        isVisible={isPageLoading || isSubmitting}
        text={isSubmitting ? "Memproses filter..." : "Memuat data..."}
        blur={true}
      />

      <header className="bg-gradient-to-r from-yellow-400 via-yellow-500 to-orange-400 shadow-xl backdrop-blur-sm">
        <div className="p-6 relative flex justify-center items-center">
          <button
            className="absolute left-6 text-yellow-900 bg-white/30 backdrop-blur-sm w-12 h-12 rounded-xl flex items-center justify-center hover:bg-white/40 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-50"
            onClick={() => navigate("/admin-menu")}
            disabled={isPageLoading || isSubmitting || isGeneratingPDF}
          >
            {isPageLoading ? (
              <SpinningLoader size="small" color="yellow" />
            ) : (
              <i className="fas fa-arrow-left text-lg"></i>
            )}
          </button>
          <div className="text-center">
            <h1 className="text-xl font-bold text-center">ThriftEase Admin</h1>
            <p className="text-yellow-800/90 text-sm font-medium">Dashboard</p>
          </div>
        </div>
      </header>

      <main className="w-full flex flex-col items-center mt-6">
        <form
          className="w-full px-6 flex justify-center space-x-4"
          onSubmit={handleFilter}
        >
          <input
            type="date"
            name="startDate"
            defaultValue={searchParams.get("startDate") || ""}
            className="border rounded-md px-4 py-2 focus:ring-2 focus:ring-yellow-300 transition-all duration-200"
            disabled={isPageLoading || isSubmitting || isGeneratingPDF}
          />
          <input
            type="date"
            name="endDate"
            defaultValue={searchParams.get("endDate") || ""}
            className="border rounded-md px-4 py-2 focus:ring-2 focus:ring-yellow-300 transition-all duration-200"
            disabled={isPageLoading || isSubmitting || isGeneratingPDF}
          />
          <button
            type="submit"
            className="bg-yellow-400 text-white px-4 py-2 rounded-md hover:bg-yellow-500 transition-colors duration-200 relative flex items-center justify-center min-w-[80px]"
            disabled={isPageLoading || isSubmitting || isGeneratingPDF}
          >
            {isSubmitting ? (
              <>
                <SpinningLoader size="small" color="white" />
                <span className="ml-2">Filter</span>
              </>
            ) : (
              "Filter"
            )}
          </button>
        </form>

        <button
          onClick={generatePDF}
          className="mt-4 bg-yellow-400 text-black px-6 py-2 rounded-md hover:bg-yellow-500 transition-colors duration-200 relative flex items-center justify-center min-w-[180px]"
          disabled={isGeneratingPDF || isPageLoading || isSubmitting}
        >
          {isGeneratingPDF ? (
            <>
              <DoubleRingSpinner size="small" />
              <span className="ml-2">Mengunduh PDF...</span>
            </>
          ) : (
            "Unduh Laporan PDF"
          )}
        </button>

        <div className="w-full flex flex-col sm:flex-row justify-center mt-6 space-y-4 sm:space-y-0 sm:space-x-2">
          <div className="bg-white shadow-md p-4 rounded-md w-full sm:w-1/2 md:w-1/4 relative">
            {isPageLoading && (
              <div className="absolute inset-0 bg-white bg-opacity-70 flex items-center justify-center rounded-md">
                <SpinningLoader size="medium" color="yellow" />
              </div>
            )}
            <h3 className="font-semibold text-base sm:text-lg">
              Total Pemasukan
            </h3>
            <p className="text-yellow-400 text-xl sm:text-2xl font-bold">
              Rp. {totalIncome.toLocaleString()}
            </p>
            <p className="text-gray-400 text-sm sm:text-base">
              Dalam rentang waktu
            </p>
          </div>

          <div className="bg-white shadow-md p-4 rounded-md w-full sm:w-1/2 md:w-1/4 relative">
            {isPageLoading && (
              <div className="absolute inset-0 bg-white bg-opacity-70 flex items-center justify-center rounded-md">
                <SpinningLoader size="medium" color="yellow" />
              </div>
            )}
            <h3 className="font-semibold text-base sm:text-lg">
              Total Transaksi
            </h3>
            <p className="text-black text-xl sm:text-2xl font-bold">
              {totalTransactions}
            </p>
            <p className="text-gray-400 text-sm sm:text-base">
              Dalam rentang waktu
            </p>
          </div>

          <div className="bg-white shadow-md p-4 rounded-md w-full sm:w-1/2 md:w-1/4 relative">
            {isPageLoading && (
              <div className="absolute inset-0 bg-white bg-opacity-70 flex items-center justify-center rounded-md">
                <SpinningLoader size="medium" color="yellow" />
              </div>
            )}
            <h3 className="font-semibold text-base sm:text-lg">
              Total Pesanan
            </h3>
            <p className="text-black text-xl sm:text-2xl font-bold">
              {totalOrders}
            </p>
            <p className="text-gray-400 text-sm sm:text-base">
              Dalam rentang waktu
            </p>
          </div>
        </div>

        <div className="w-full mt-6 px-6 relative">
          {isPageLoading && (
            <div className="absolute inset-0 bg-white bg-opacity-70 flex items-center justify-center z-10 rounded-md">
              <div className="flex flex-col items-center">
                <SpinningLoader size="large" color="blue" />
                <p className="mt-2 text-gray-600">Memuat grafik pesanan...</p>
              </div>
            </div>
          )}
          <h3 className="text-center text-blue-400 font-semibold mb-4">
            Grafik Total Pesanan
          </h3>
          <div className="bg-white p-4 rounded-md shadow-md">
            <Line data={ordersData} />
          </div>
        </div>

        <div className="w-full mt-6 px-6 mb-6 relative">
          {isPageLoading && (
            <div className="absolute inset-0 bg-white bg-opacity-70 flex items-center justify-center z-10 rounded-md">
              <div className="flex flex-col items-center">
                <SpinningLoader size="large" color="red" />
                <p className="mt-2 text-gray-600">Memuat grafik transaksi...</p>
              </div>
            </div>
          )}
          <h3 className="text-center text-blue-400 font-semibold mb-4">
            Grafik Total Transaksi
          </h3>
          <div className="bg-white p-4 rounded-md shadow-md">
            <Line data={transactionsData} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
