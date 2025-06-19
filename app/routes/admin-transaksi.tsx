import { useState } from "react";
import { useNavigate, useLoaderData, useNavigation } from "@remix-run/react";
import { json, type ActionFunctionArgs } from "@remix-run/node";
import { PrismaClient, PaymentStatus } from "@prisma/client";
import {
  SpinningLoader,
  LoadingOverlay,
} from "../routes/components/SpinningLoader";

const prisma = new PrismaClient();

// Type definitions
interface Payment {
  id: string;
  method: string;
  status: string;
  amount: number;
  paymentDate: Date | null;
  updatedAt: Date;
  createdAt: Date;
  order: {
    id: string;
    items?: Array<{
      id: string;
      productId: string;
    }>;
  };
}

interface LoaderData {
  payments: Payment[];
}

// Loader untuk mengambil data transaksi
export const loader = async () => {
  const payments = await prisma.payment.findMany({
    include: {
      order: {
        include: {
          items: true
        }
      }, // Include informasi pesanan terkait transaksi
    },
    orderBy: {
      updatedAt: 'desc', // Sort by updatedAt in descending order (newest first)
    },
  });

  return json<LoaderData>({ payments });
};

// Action untuk mengupdate status transaksi
export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const actionType = formData.get("actionType")?.toString();
  const paymentId = formData.get("paymentId")?.toString();
  const status = formData.get("status")?.toString();
  const paymentDate = formData.get("paymentDate")?.toString(); // Tanggal pembayaran baru

  if (!paymentId || (actionType === "updateStatus" && !status)) {
    return json({ error: "Payment ID dan status diperlukan" }, { status: 400 });
  }

  try {
    if (actionType === "updateStatus" && status) {
      const updateData: { status: string; paymentDate?: Date; updatedAt: Date } = { 
        status,
        updatedAt: new Date()
      };

      // Tambahkan paymentDate jika status SUCCESS
      if (status === "SUCCESS" && paymentDate) {
        updateData.paymentDate = new Date(paymentDate);
      }

      const payment = await prisma.payment.update({
        where: { id: paymentId },
        data: {
          ...updateData,
          status: status as PaymentStatus, // Cast to PaymentStatus enum type
        },
        include: { order: { include: { items: true } } },
      });

      // Jika status transaksi diubah menjadi FAILED
      if (status === "FAILED") {
        // Ubah status pesanan menjadi CANCELLED
        await prisma.order.update({
          where: { id: payment.order.id },
          data: { status: "CANCELLED" },
        });

        // Set isVisible menjadi true untuk setiap produk dalam pesanan
        if (payment.order.items) {
          const productUpdates = payment.order.items.map((item) =>
            prisma.product.update({
              where: { id: item.productId },
              data: { isVisible: true },
            })
          );
          await Promise.all(productUpdates);
        }
      }
    }

    return json({ success: true });
  } catch (error) {
    console.error(error);
    return json(
      { error: "Gagal mengupdate transaksi" },
      { status: 500 }
    );
  }
};

const AdminTransaksiPage = () => {
  const navigate = useNavigate();
  const navigation = useNavigation();
  const { payments } = useLoaderData<typeof loader>();
  const [searchTerm, setSearchTerm] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState<{
    [key: string]: boolean;
  }>({});
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [selectedMethod, setSelectedMethod] = useState<string>("ALL");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Check if page is loading
  const isPageLoading = navigation.state === "loading";
  const isSubmitting = navigation.state === "submitting";

  const setStatusUpdating = (id: string, isUpdating: boolean) => {
    setUpdatingStatus(prev => ({
      ...prev,
      [id]: isUpdating
    }));
  };

  // Status styling configuration
  const getStatusStyle = (status: string) => {
    const styles = {
      PENDING: "bg-yellow-100 text-yellow-800 border-yellow-200",
      SUCCESS: "bg-green-100 text-green-800 border-green-200",
      FAILED: "bg-red-100 text-red-800 border-red-200"
    };
    return styles[status as keyof typeof styles] || "bg-gray-100 text-gray-800 border-gray-200";
  };

  const getStatusIcon = (status: string) => {
    const icons = {
      PENDING: "fas fa-clock",
      SUCCESS: "fas fa-check-circle",
      FAILED: "fas fa-times-circle"
    };
    return icons[status as keyof typeof icons] || "fas fa-question-circle";
  };

  const getMethodIcon = (method: string) => {
    const icons = {
      "Bank Transfer": "fas fa-university",
      "Credit Card": "fas fa-credit-card",
      "E-Wallet": "fas fa-wallet",
      "Cash": "fas fa-money-bill-alt"
    };
    return icons[method as keyof typeof icons] || "fas fa-money-bill-wave";
  };

  // Filter transaksi berdasarkan kata kunci pencarian, status, metode, dan tanggal
  const filteredPayments = payments
    .filter((payment) => {
      const matchesSearch = payment.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           payment.order.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = selectedStatus === "ALL" || payment.status === selectedStatus;
      const matchesMethod = selectedMethod === "ALL" || payment.method === selectedMethod;
      
      // Filter berdasarkan tanggal
      let matchesDate = true;
      if (startDate || endDate) {
        const paymentDate = new Date(payment.createdAt);
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;
        
        if (start && end) {
          // Set end date to end of day
          end.setHours(23, 59, 59, 999);
          matchesDate = paymentDate >= start && paymentDate <= end;
        } else if (start) {
          matchesDate = paymentDate >= start;
        } else if (end) {
          // Set end date to end of day
          end.setHours(23, 59, 59, 999);
          matchesDate = paymentDate <= end;
        }
      }
      
      return matchesSearch && matchesStatus && matchesMethod && matchesDate;
    })
    .sort((a, b) => {
      // Sort by updatedAt descending (terbaru dulu)
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

  // Get payment statistics
  const paymentStats = {
    total: payments.length,
    pending: payments.filter(p => p.status === "PENDING").length,
    success: payments.filter(p => p.status === "SUCCESS").length,
    failed: payments.filter(p => p.status === "FAILED").length,
    totalAmount: payments.filter(p => p.status === "SUCCESS").reduce((sum, p) => sum + p.amount, 0),
  };

  // Get unique payment methods
  const paymentMethods = [...new Set(payments.map(p => p.method))];

  // Fungsi untuk mengupdate status transaksi
  const handleStatusUpdate = async (paymentId: string, newStatus: string) => {
    if (!newStatus) return;

    setStatusUpdating(paymentId, true);

    try {
      const paymentDate =
        newStatus === "SUCCESS" ? new Date().toISOString() : "";

      const formData = new URLSearchParams();
      formData.append("paymentId", paymentId);
      formData.append("status", newStatus);
      if (paymentDate) {
        formData.append("paymentDate", paymentDate);
      }
      formData.append("actionType", "updateStatus");

      const response = await fetch(`/admin-transaksi`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        alert("Gagal mengupdate status transaksi");
      } else {
        window.location.reload();
      }
    } catch (error) {
      alert("Terjadi kesalahan saat mengupdate status");
      console.error(error);
    } finally {
      setStatusUpdating(paymentId, false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Loading Overlay untuk page loading */}
      <LoadingOverlay
        isVisible={isPageLoading}
        text="Memuat halaman transaksi..."
        blur={true}
      />
      
      <LoadingOverlay
        isVisible={isSubmitting}
        text="Memproses..."
        blur={true}
      />

      {/* Header dengan gradient dan shadow */}
      <header className="bg-gradient-to-r from-yellow-400 via-yellow-500 to-orange-400 shadow-xl backdrop-blur-sm">
        <div className="p-6 relative flex justify-center items-center">
          <button
            className="absolute left-6 text-yellow-900 bg-white/30 backdrop-blur-sm w-12 h-12 rounded-xl flex items-center justify-center hover:bg-white/40 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-50"
            onClick={() => navigate("/admin-menu")}
            disabled={isPageLoading || isSubmitting}
          >
            {isPageLoading ? (
              <SpinningLoader size="small" color="yellow" />
            ) : (
              <i className="fas fa-arrow-left text-lg"></i>
            )}
          </button>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-yellow-900 mb-1">ThriftEase Admin</h1>
            <p className="text-yellow-800/90 text-sm font-medium">Transaksi</p>
          </div>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="p-6 -mt-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 justify-center">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total</p>
                <p className="text-2xl font-bold text-gray-800">{paymentStats.total}</p>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-lg flex items-center justify-center">
                <i className="fas fa-receipt text-yellow-900 text-sm"></i>
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-yellow-600">Pending</p>
                <p className="text-2xl font-bold text-yellow-700">{paymentStats.pending}</p>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-yellow-300 to-yellow-400 rounded-lg flex items-center justify-center">
                <i className="fas fa-clock text-yellow-900 text-sm"></i>
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Success</p>
                <p className="text-2xl font-bold text-green-700">{paymentStats.success}</p>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-500 rounded-lg flex items-center justify-center">
                <i className="fas fa-check-circle text-white text-sm"></i>
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-600">Failed</p>
                <p className="text-2xl font-bold text-red-700">{paymentStats.failed}</p>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-red-400 to-pink-500 rounded-lg flex items-center justify-center">
                <i className="fas fa-times-circle text-white text-sm"></i>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filter Controls */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20 mb-6">
          <div className="flex flex-col gap-4">
            {/* First row: Search, Status, and Method */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Cari berdasarkan ID transaksi atau ID pesanan..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full p-4 pl-12 rounded-xl border-2 border-gray-200 focus:outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-200 transition-all duration-300 disabled:opacity-50 bg-white/50 backdrop-blur-sm"
                  disabled={isPageLoading || isSubmitting}
                />
                <i className="fas fa-search absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 text-lg"></i>
              </div>
              <div className="md:w-48">
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full p-4 rounded-xl border-2 border-gray-200 focus:outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-200 transition-all duration-300 disabled:opacity-50 bg-white/50 backdrop-blur-sm"
                  disabled={isPageLoading || isSubmitting}
                >
                  <option value="ALL">Semua Status</option>
                  <option value="PENDING">PENDING</option>
                  <option value="SUCCESS">SUCCESS</option>
                  <option value="FAILED">FAILED</option>
                </select>
              </div>
              <div className="md:w-48">
                <select
                  value={selectedMethod}
                  onChange={(e) => setSelectedMethod(e.target.value)}
                  className="w-full p-4 rounded-xl border-2 border-gray-200 focus:outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-200 transition-all duration-300 disabled:opacity-50 bg-white/50 backdrop-blur-sm"
                  disabled={isPageLoading || isSubmitting}
                >
                  <option value="ALL">Semua Metode</option>
                  {paymentMethods.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            {/* Second row: Date filters */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <label htmlFor="start-date" className="block text-sm font-medium text-gray-700 mb-2">
                  <i className="fas fa-calendar-day mr-2 text-yellow-600"></i>
                  Tanggal Mulai
                </label>
                <input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full p-4 rounded-xl border-2 border-gray-200 focus:outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-200 transition-all duration-300 disabled:opacity-50 bg-white/50 backdrop-blur-sm"
                  disabled={isPageLoading || isSubmitting}
                />
              </div>
              <div className="flex-1">
                <label htmlFor="end-date" className="block text-sm font-medium text-gray-700 mb-2">
                  <i className="fas fa-calendar-day mr-2 text-yellow-600"></i>
                  Tanggal Selesai
                </label>
                <input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full p-4 rounded-xl border-2 border-gray-200 focus:outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-200 transition-all duration-300 disabled:opacity-50 bg-white/50 backdrop-blur-sm"
                  disabled={isPageLoading || isSubmitting}
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setStartDate("");
                    setEndDate("");
                  }}
                  className="px-6 py-4 bg-gradient-to-r from-gray-400 to-gray-500 text-white rounded-xl hover:from-gray-500 hover:to-gray-600 transition-all duration-300 font-medium disabled:opacity-50 shadow-lg hover:shadow-xl transform hover:scale-105"
                  disabled={isPageLoading || isSubmitting || (!startDate && !endDate)}
                >
                  <i className="fas fa-times mr-2"></i>
                  Clear
                </button>
              </div>
            </div>
            
            {/* Filter info and stats */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pt-4 border-t border-gray-200">
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center text-gray-600">
                  <i className="fas fa-filter mr-2 text-yellow-600"></i>
                  <span className="font-medium">Hasil filter: </span>
                  <span className="font-bold text-yellow-700 ml-1">{filteredPayments.length}</span>
                  <span className="text-gray-500 ml-1">dari {payments.length} transaksi</span>
                </div>
                {(startDate || endDate) && (
                  <div className="flex items-center text-blue-600">
                    <i className="fas fa-calendar-alt mr-2"></i>
                    <span className="font-medium">
                      {startDate && endDate ? `${new Date(startDate).toLocaleDateString('id-ID')} - ${new Date(endDate).toLocaleDateString('id-ID')}` :
                       startDate ? `Dari ${new Date(startDate).toLocaleDateString('id-ID')}` :
                       endDate ? `Sampai ${new Date(endDate).toLocaleDateString('id-ID')}` : ''}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Payments Table */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-yellow-900">
                  <th className="p-4 text-left font-semibold">
                    <div className="flex items-center space-x-2">
                      <i className="fas fa-hashtag"></i>
                      <span>ID Transaksi</span>
                    </div>
                  </th>
                  <th className="p-4 text-left font-semibold">
                    <div className="flex items-center space-x-2">
                      <i className="fas fa-shopping-cart"></i>
                      <span>Pesanan</span>
                    </div>
                  </th>
                  <th className="p-4 text-left font-semibold">
                    <div className="flex items-center space-x-2">
                      <i className="fas fa-credit-card"></i>
                      <span>Metode</span>
                    </div>
                  </th>
                  <th className="p-4 text-left font-semibold">
                    <div className="flex items-center space-x-2">
                      <i className="fas fa-info-circle"></i>
                      <span>Status</span>
                    </div>
                  </th>
                  <th className="p-4 text-left font-semibold">
                    <div className="flex items-center space-x-2">
                      <i className="fas fa-money-bill-wave"></i>
                      <span>Jumlah</span>
                    </div>
                  </th>
                  <th className="p-4 text-left font-semibold">
                    <div className="flex items-center space-x-2">
                      <i className="fas fa-calendar"></i>
                      <span>Tanggal Update</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((payment, index) => (
                  <tr 
                    key={payment.id} 
                    className={`border-b border-gray-100 hover:bg-yellow-50/50 transition-all duration-200 ${
                      index % 2 === 0 ? 'bg-white/30' : 'bg-white/50'
                    }`}
                  >
                    <td className="p-4">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-8 bg-gradient-to-b from-yellow-400 to-yellow-500 rounded-full"></div>
                        <span className="font-mono text-sm font-semibold text-gray-700 break-all">
                          {payment.id}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-300 to-blue-400 rounded-full flex items-center justify-center">
                          <i className="fas fa-shopping-cart text-blue-900 text-xs"></i>
                        </div>
                        <span className="font-medium text-gray-700 font-mono text-sm">
                          {payment.order.id}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-purple-300 to-purple-400 rounded-full flex items-center justify-center">
                          <i className={`${getMethodIcon(payment.method)} text-purple-900 text-xs`}></i>
                        </div>
                        <span className="font-medium text-gray-700">{payment.method}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${getStatusStyle(payment.status)}`}>
                            <i className={`${getStatusIcon(payment.status)} mr-1`}></i>
                            {payment.status}
                          </span>
                        </div>
                        <select
                          value={payment.status}
                          onChange={(e) =>
                            handleStatusUpdate(payment.id, e.target.value)
                          }
                          className="p-2 border-2 border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-200 transition-all duration-200 disabled:opacity-50 bg-white/70 backdrop-blur-sm"
                          disabled={
                            updatingStatus[payment.id] || 
                            isPageLoading || 
                            isSubmitting
                          }
                        >
                          {["PENDING", "SUCCESS", "FAILED"].map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                        {updatingStatus[payment.id] && (
                          <SpinningLoader size="small" color="yellow" />
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 bg-gradient-to-br from-green-400 to-emerald-500 rounded-lg flex items-center justify-center">
                          <i className="fas fa-rupiah-sign text-white text-xs"></i>
                        </div>
                        <span className="font-bold text-lg text-gray-800">
                          {payment.amount.toLocaleString('id-ID')}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 bg-gradient-to-br from-gray-400 to-gray-600 rounded-lg flex items-center justify-center">
                          <i className="fas fa-calendar-alt text-white text-xs"></i>
                        </div>
                        <span className="text-gray-600 font-medium">
                          {new Date(payment.updatedAt).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredPayments.length === 0 && !isPageLoading && (
            <div className="text-center py-16">
              <div className="w-24 h-24 bg-gradient-to-br from-gray-300 to-gray-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-receipt text-4xl text-white"></i>
              </div>
              <h3 className="text-xl font-semibold text-gray-600 mb-2">Tidak Ada Transaksi</h3>
              <p className="text-gray-500">Tidak ada transaksi yang sesuai dengan kriteria pencarian Anda</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminTransaksiPage;