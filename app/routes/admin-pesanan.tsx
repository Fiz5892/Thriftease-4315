import { useState } from "react";
import { useNavigate, useLoaderData, useNavigation } from "@remix-run/react";
import { json, ActionFunctionArgs } from "@remix-run/node";
import { PrismaClient } from "@prisma/client";
import {
  SpinningLoader,
  LoadingOverlay,
} from "../routes/components/SpinningLoader";

const prisma = new PrismaClient();

// Types - Define OrderStatus enum to match Prisma schema
enum OrderStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING", 
  SHIPPED = "SHIPPED",
  DELIVERED = "DELIVERED",
  CANCELLED = "CANCELLED",
  COMPLETED = "COMPLETED"
}

interface User {
  id: string;
  // Add other user properties as needed
}

interface Order {
  id: string;
  status: OrderStatus;
  totalAmount: number;
  createdAt: string;
  updatedAt: string; // Add updatedAt field
  user: User;
}

interface LoaderData {
  orders: Order[];
}

// Loader untuk mengambil data pesanan
export const loader = async () => {
  const orders = await prisma.order.findMany({
    include: {
      user: true, // Include informasi user terkait pesanan
    },
    orderBy: {
      updatedAt: 'desc' // Sort by updatedAt descending (terbaru dulu)
    }
  });

  return json({ orders });
};

// Action untuk mengupdate status pesanan
export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const orderId = formData.get("orderId") as string;
  const status = formData.get("status") as OrderStatus;

  if (!orderId || !status) {
    return json({ error: "Order ID dan status diperlukan" }, { status: 400 });
  }

  try {
    await prisma.order.update({
      where: { id: orderId },
      data: { 
        status,
        updatedAt: new Date() // Update timestamp when status changes
      },
    });

    return json({ success: true });
  } catch (error) {
    console.error(error);
    return json({ error: "Gagal mengupdate status pesanan" }, { status: 500 });
  }
};

const AdminPesananPage = () => {
  const navigate = useNavigate();
  const navigation = useNavigation();
  const { orders } = useLoaderData<LoaderData>();
  const [searchTerm, setSearchTerm] = useState("");
  const [loadingOrderId, setLoadingOrderId] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Check if page is loading
  const isPageLoading = navigation.state === "loading";
  const isSubmitting = navigation.state === "submitting";

  // Status styling configuration
  const getStatusStyle = (status: OrderStatus) => {
    const styles = {
      PENDING: "bg-yellow-100 text-yellow-800 border-yellow-200",
      PROCESSING: "bg-blue-100 text-blue-800 border-blue-200",
      SHIPPED: "bg-purple-100 text-purple-800 border-purple-200",
      DELIVERED: "bg-green-100 text-green-800 border-green-200",
      CANCELLED: "bg-red-100 text-red-800 border-red-200",
      COMPLETED: "bg-emerald-100 text-emerald-800 border-emerald-200"
    };
    return styles[status] || "bg-gray-100 text-gray-800 border-gray-200";
  };

  const getStatusIcon = (status: OrderStatus) => {
    const icons = {
      PENDING: "fas fa-clock",
      PROCESSING: "fas fa-cogs",
      SHIPPED: "fas fa-truck",
      DELIVERED: "fas fa-check-circle",
      CANCELLED: "fas fa-times-circle",
      COMPLETED: "fas fa-star"
    };
    return icons[status] || "fas fa-question-circle";
  };

  // Filter dan sort pesanan berdasarkan kata kunci pencarian, status, tanggal, dan update terbaru
  const filteredOrders = orders
    .filter((order: Order) => {
      const matchesSearch = order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           order.user.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = selectedStatus === "ALL" || order.status === selectedStatus;
      
      // Filter berdasarkan tanggal
      let matchesDate = true;
      if (startDate || endDate) {
        const orderDate = new Date(order.createdAt);
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;
        
        if (start && end) {
          // Set end date to end of day
          end.setHours(23, 59, 59, 999);
          matchesDate = orderDate >= start && orderDate <= end;
        } else if (start) {
          matchesDate = orderDate >= start;
        } else if (end) {
          // Set end date to end of day
          end.setHours(23, 59, 59, 999);
          matchesDate = orderDate <= end;
        }
      }
      
      return matchesSearch && matchesStatus && matchesDate;
    })
    .sort((a, b) => {
      // Sort by updatedAt descending (terbaru dulu)
      return new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime();
    });

  // Get order statistics
  const orderStats = {
    total: orders.length,
    pending: orders.filter(o => o.status === "PENDING").length,
    processing: orders.filter(o => o.status === "PROCESSING").length,
    shipped: orders.filter(o => o.status === "SHIPPED").length,
    delivered: orders.filter(o => o.status === "DELIVERED").length,
    completed: orders.filter(o => o.status === "COMPLETED").length,
    cancelled: orders.filter(o => o.status === "CANCELLED").length,
  };

  // Fungsi untuk mengupdate status pesanan
  const handleStatusUpdate = async (orderId: string, newStatus: OrderStatus) => {
    setLoadingOrderId(orderId);

    try {
      const response = await fetch(`/admin-pesanan`, {
        method: "POST",
        body: new URLSearchParams({ 
          orderId, 
          status: newStatus
        }),
      });
    
      if (!response.ok) {
        alert("Gagal mengupdate status pesanan");
      } else {
        // Reload page to get updated data with new sorting
        window.location.reload();
      }
    } catch (error) {
      alert("Terjadi kesalahan saat mengupdate status");
    } finally {
      setLoadingOrderId(null);
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Loading Overlay untuk page loading dan form submission */}
      <LoadingOverlay
        isVisible={isPageLoading}
        text="Memuat halaman pesanan..."
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
            disabled={isPageLoading || isSubmitting || loadingOrderId !== null}
          >
            {isPageLoading ? (
              <SpinningLoader size="small" color="yellow" />
            ) : (
              <i className="fas fa-arrow-left text-lg"></i>
            )}
          </button>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-yellow-900 mb-1">ThriftEase Admin</h1>
            <p className="text-yellow-800/90 text-sm font-medium">Dashboard Manajemen Pesanan</p>
          </div>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="p-6 -mt-4">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total</p>
                <p className="text-2xl font-bold text-gray-800">{orderStats.total}</p>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-lg flex items-center justify-center">
                <i className="fas fa-shopping-cart text-yellow-900 text-sm"></i>
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-yellow-600">Pending</p>
                <p className="text-2xl font-bold text-yellow-700">{orderStats.pending}</p>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-yellow-300 to-yellow-400 rounded-lg flex items-center justify-center">
                <i className="fas fa-clock text-yellow-900 text-sm"></i>
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Processing</p>
                <p className="text-2xl font-bold text-blue-700">{orderStats.processing}</p>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-lg flex items-center justify-center">
                <i className="fas fa-cogs text-white text-sm"></i>
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600">Shipped</p>
                <p className="text-2xl font-bold text-purple-700">{orderStats.shipped}</p>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-pink-500 rounded-lg flex items-center justify-center">
                <i className="fas fa-truck text-white text-sm"></i>
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Delivered</p>
                <p className="text-2xl font-bold text-green-700">{orderStats.delivered}</p>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-500 rounded-lg flex items-center justify-center">
                <i className="fas fa-check-circle text-white text-sm"></i>
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-600">Completed</p>
                <p className="text-2xl font-bold text-emerald-700">{orderStats.completed}</p>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-lg flex items-center justify-center">
                <i className="fas fa-star text-white text-sm"></i>
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-600">Cancelled</p>
                <p className="text-2xl font-bold text-red-700">{orderStats.cancelled}</p>
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
            {/* First row: Search and Status */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Cari berdasarkan ID pesanan atau User ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full p-4 pl-12 rounded-xl border-2 border-gray-200 focus:outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-200 transition-all duration-300 disabled:opacity-50 bg-white/50 backdrop-blur-sm"
                  disabled={isPageLoading || isSubmitting}
                />
                <i className="fas fa-search absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 text-lg"></i>
              </div>
              <div className="md:w-64">
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full p-4 rounded-xl border-2 border-gray-200 focus:outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-200 transition-all duration-300 disabled:opacity-50 bg-white/50 backdrop-blur-sm"
                  disabled={isPageLoading || isSubmitting}
                >
                  <option value="ALL">Semua Status</option>
                  {Object.values(OrderStatus).map((status) => (
                    <option key={status} value={status}>
                      {status}
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
                  <span className="font-bold text-yellow-700 ml-1">{filteredOrders.length}</span>
                  <span className="text-gray-500 ml-1">dari {orders.length} pesanan</span>
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

        {/* Orders Table */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-yellow-900">
                  <th className="p-4 text-left font-semibold">
                    <div className="flex items-center space-x-2">
                      <i className="fas fa-hashtag"></i>
                      <span>ID Pesanan</span>
                    </div>
                  </th>
                  <th className="p-4 text-left font-semibold">
                    <div className="flex items-center space-x-2">
                      <i className="fas fa-user"></i>
                      <span>User</span>
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
                      <span>Total</span>
                    </div>
                  </th>
                  <th className="p-4 text-left font-semibold">
                    <div className="flex items-center space-x-2">
                      <i className="fas fa-calendar"></i>
                      <span>Tanggal</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order: Order, index) => (
                  <tr 
                    key={order.id} 
                    className={`border-b border-gray-100 hover:bg-yellow-50/50 transition-all duration-200 ${
                      index % 2 === 0 ? 'bg-white/30' : 'bg-white/50'
                    }`}
                  >
                    <td className="p-4">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-8 bg-gradient-to-b from-yellow-400 to-yellow-500 rounded-full"></div>
                        <span className="font-mono text-sm font-semibold text-gray-700 break-all">
                          {order.id}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-yellow-300 to-yellow-400 rounded-full flex items-center justify-center">
                          <i className="fas fa-user text-yellow-900 text-xs"></i>
                        </div>
                        <span className="font-medium text-gray-700">{order.user.id}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${getStatusStyle(order.status)}`}>
                            <i className={`${getStatusIcon(order.status)} mr-1`}></i>
                            {order.status}
                          </span>
                        </div>
                        <select
                          value={order.status}
                          onChange={(e) =>
                            handleStatusUpdate(order.id, e.target.value as OrderStatus)
                          }
                          className="p-2 border-2 border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-200 transition-all duration-200 disabled:opacity-50 bg-white/70 backdrop-blur-sm"
                          disabled={
                            isPageLoading || 
                            isSubmitting || 
                            loadingOrderId === order.id
                          }
                        >
                          {Object.values(OrderStatus).map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                        {loadingOrderId === order.id && (
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
                          {order.totalAmount.toLocaleString('id-ID')}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 bg-gradient-to-br from-gray-400 to-gray-600 rounded-lg flex items-center justify-center">
                          <i className="fas fa-calendar-alt text-white text-xs"></i>
                        </div>
                        <span className="text-gray-600 font-medium">
                          {new Date(order.createdAt).toLocaleDateString('id-ID', {
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

          {filteredOrders.length === 0 && !isPageLoading && (
            <div className="text-center py-16">
              <div className="w-24 h-24 bg-gradient-to-br from-gray-300 to-gray-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-inbox text-4xl text-white"></i>
              </div>
              <h3 className="text-xl font-semibold text-gray-600 mb-2">Tidak Ada Pesanan</h3>
              <p className="text-gray-500">Tidak ada pesanan yang sesuai dengan kriteria pencarian Anda</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPesananPage;