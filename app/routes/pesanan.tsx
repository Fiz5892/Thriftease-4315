import { useLoaderData, useFetcher, useNavigate } from "@remix-run/react";
import { json, LoaderFunction, redirect } from "@remix-run/node";
import { authenticator } from "~/utils/auth.server";
import { PrismaClient } from "@prisma/client";
import { getTemporaryOrder } from "~/utils/orders.server";
import { useMemo } from "react";

const prisma = new PrismaClient();

// Cache untuk location data - simpan di memory untuk menghindari request berulang
const locationCache = new Map<string, any>();

// Optimized Loader: Paralel execution dan caching
export const loader: LoaderFunction = async ({ request }) => {
  const user = await authenticator.isAuthenticated(request);
  if (!user) return redirect("/login");

  // Get temporary order data first
  const orderData = getTemporaryOrder(user.id);
  if (!orderData) {
    return redirect("/cart");
  }

  // Single optimized query untuk user details
  const userDetails = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      username: true,
      email: true,
      phoneNumber: true,
      fullName: true,
      province: true,
      city: true,
      district: true,
      postalCode: true,
      address: true,
    },
  });

  if (!userDetails?.address) {
    return redirect("/account");
  }

  const { province, city, district } = userDetails;

  // Optimized location fetching dengan caching
  let locationData: { 
    provinceName: string | null; 
    cityName: string | null; 
    districtName: string | null 
  } = { 
    provinceName: null, 
    cityName: null, 
    districtName: null 
  };

  try {
    const cacheKey = `${province}-${city}-${district}`;
    
    // Check cache first
    if (locationCache.has(cacheKey)) {
      locationData = locationCache.get(cacheKey);
    } else {
      // Optimized: Hanya fetch yang diperlukan, bukan semua data
      const locationPromises = [];
      
      // Hanya fetch province jika belum ada di cache
      const provinceKey = `province-${province}`;
      if (!locationCache.has(provinceKey)) {
        locationPromises.push(
          fetch('https://jasonslav.github.io/api-wilayah-indonesia/api/provinces.json')
            .then(res => res.json())
            .then(data => {
              locationCache.set(provinceKey, data);
              return { type: 'province', data };
            })
        );
      }

      // Similar untuk city dan district
      const cityKey = `city-${city}`;
      if (!locationCache.has(cityKey)) {
        locationPromises.push(
          fetch(`https://jasonslav.github.io/api-wilayah-indonesia/api/regencies/${province}.json`)
            .then(res => res.json())
            .then(data => {
              locationCache.set(cityKey, data);
              return { type: 'city', data };
            })
        );
      }

      const districtKey = `district-${district}`;
      if (!locationCache.has(districtKey)) {
        locationPromises.push(
          fetch(`https://jasonslav.github.io/api-wilayah-indonesia/api/districts/${city}.json`)
            .then(res => res.json())
            .then(data => {
              locationCache.set(districtKey, data);
              return { type: 'district', data };
            })
        );
      }

      // Execute semua promises sekaligus
      if (locationPromises.length > 0) {
        await Promise.allSettled(locationPromises);
      }

      // Get data dari cache
      const provinceData = locationCache.get(provinceKey) || [];
      const cityData = locationCache.get(cityKey) || [];
      const districtData = locationCache.get(districtKey) || [];

      locationData = {
        provinceName: provinceData.find((item: any) => item.id === province)?.name || null,
        cityName: cityData.find((item: any) => item.id === city)?.name || null,
        districtName: districtData.find((item: any) => item.id === district)?.name || null,
      };

      // Cache hasil akhir
      locationCache.set(cacheKey, locationData);
    }
  } catch (error) {
    console.error("Error fetching location data:", error);
    // Fallback ke ID jika gagal fetch nama
    locationData = {
      provinceName: province,
      cityName: city,
      districtName: district,
    };
  }

  // Pre-calculated values dari temporary order
  const cartData = orderData.cartData;
  const subtotal = orderData.total; // Tidak dikurangi ongkir
  // const shippingCost = orderData.shippingCost; // Dihilangkan
  const total = orderData.total; // Total hanya subtotal

  return json({
    user,
    userDetails,
    locationData,
    cartData,
    subtotal,
    // shippingCost, // Dihilangkan
    total,
  });
};

// Optimized Action: Lebih efisien dengan batch operations
export const action = async ({ request }: { request: Request }) => {
  const user = await authenticator.isAuthenticated(request);
  if (!user) return redirect("/login");

  const orderData = getTemporaryOrder(user.id);
  if (!orderData) {
    return redirect("/cart");
  }

  const formData = await request.formData();
  const userDetails = JSON.parse(formData.get("userDetails") as string);
  const locationData = JSON.parse(formData.get("locationData") as string);
  
  const cartData = orderData.cartData;
  // const shippingCost = orderData.shippingCost; // Dihilangkan
  const total = orderData.total;
  const subtotal = total; // Tidak dikurangi ongkir

  try {
    // Optimized transaction dengan minimal queries
    const result = await prisma.$transaction(async (prisma) => {
      // Batch create order items
      const orderItems = cartData.map((item: any) => ({
        productId: item.product.id,
        quantity: item.quantity,
        price: item.product.price,
      }));

      // Single order creation dengan nested items
      const createdOrder = await prisma.order.create({
        data: {
          userId: user.id,
          totalAmount: total,
          items: {
            create: orderItems,
          },
        },
        select: {
          id: true,
          items: {
            select: {
              quantity: true,
              price: true,
              product: {
                select: {
                  name: true,
                }
              }
            }
          },
        },
      });

      // Create payment record
      await prisma.payment.create({
        data: {
          orderId: createdOrder.id,
          method: "BANK_TRANSFER",
          status: "PENDING",
          amount: total,
        },
      });

      // Batch operations
      const productIds = cartData.map((item: any) => item.product.id);
      const cartItemIds = cartData.map((item: any) => item.id);

      // Parallel execution untuk update dan delete
      await Promise.all([
        // Update product visibility
        prisma.product.updateMany({
          where: { id: { in: productIds } },
          data: { isVisible: false },
        }),
        // Remove cart items
        prisma.cartItem.deleteMany({
          where: { 
            id: { in: cartItemIds },
            cart: { userId: user.id }
          },
        }),
      ]);

      return createdOrder;
    });

    // Pre-build WhatsApp message untuk menghindari processing di frontend
    const whatsappMessage = generateWhatsAppMessage(
      result,
      userDetails,
      locationData,
      subtotal,
      // shippingCost, // Dihilangkan
      total
    );

    const whatsappUrl = `https://wa.me/6285707293619?text=${encodeURIComponent(whatsappMessage)}`;
    return redirect(whatsappUrl);

  } catch (error) {
    console.error("Order creation failed:", error);
    return json({ error: "Gagal membuat pesanan" }, { status: 500 });
  }
};

// Helper function untuk generate WhatsApp message
function generateWhatsAppMessage(
  order: any,
  userDetails: any,
  locationData: any,
  subtotal: number,
  // shippingCost: number, // Dihilangkan
  total: number
): string {
  const itemsList = order.items
    .map((item: any) =>
      `- *${item.product.name}*  
      📦 Qty: ${item.quantity}  
      💰 Subtotal: Rp ${(item.price * item.quantity).toLocaleString()}`
    )
    .join("\n");

  return `
*📦 PESANAN-THRIFTEASE 📦*
=========================
📄 *Order ID:* ${order.id}

👤 *Nama Pemesan:* ${userDetails.fullName}
📱 *No. Telepon:* ${userDetails.phoneNumber}
🏡 *Alamat Pengiriman:*
    ${userDetails.address}
    ${locationData.districtName}, ${locationData.cityName},
    ${locationData.provinceName} - ${userDetails.postalCode}

🛒 *Detail Pesanan:*
${itemsList}

=========================
💵 *Subtotal Produk:* Rp ${subtotal.toLocaleString()}
=========================
💳 *Total Pembayaran:* Rp ${total.toLocaleString()}
=========================
🙏 Terima kasih telah berbelanja di *Thriftease*!  
Kami akan segera memproses pesanan Anda.

📌 Harap segera lakukan konfirmasi jika ada perubahan informasi.
  `.trim();
}

// Frontend Types
import type { User } from "@prisma/client";

type LocationData = {
  provinceName: string | null;
  cityName: string | null;
  districtName: string | null;
};

type CartItem = {
  id: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    price: number;
    size: string;
    images: { url: string }[];
  };
};

type LoaderData = {
  user: User;
  userDetails: Partial<User>;
  locationData: LocationData;
  cartData: CartItem[];
  subtotal: number;
  shippingCost: number;
  total: number;
};

// Optimized Frontend Component
export default function PesananPage() {
  const { userDetails, locationData, cartData, subtotal, total } =
    useLoaderData<LoaderData>();
  const fetcher = useFetcher();
  const navigate = useNavigate();

  // Memoized calculations untuk performa lebih baik
  const isSubmitting = useMemo(() => 
    fetcher.state === "submitting", 
    [fetcher.state]
  );

  const handleConfirmOrder = () => {
    if (isSubmitting) return; // Prevent double submission
    
    fetcher.submit(
      {
        userDetails: JSON.stringify(userDetails),
        locationData: JSON.stringify(locationData),
        total: total.toString(),
        // shippingCost: shippingCost.toString(), // Dihilangkan
      },
      { method: "post" }
    );
  };

  // Memoized address string
  const fullAddress = useMemo(() => 
    `${userDetails.address}, ${locationData.districtName}, ${locationData.cityName}, ${locationData.provinceName}, ${userDetails.postalCode}, ID`,
    [userDetails.address, locationData, userDetails.postalCode]
  );

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Header Sticky with Bottom Border */}
      <header className="sticky top-0 flex items-center border-b border-gray-300 pb-2 lg:pb-4 mb-4 lg:mb-6 w-full px-4 lg:px-8 bg-white pt-4 z-10">
        <button
          onClick={() => navigate(-1)}
          className="w-8 h-8 lg:w-10 lg:h-10 bg-yellow-300 rounded-full flex items-center justify-center"
          disabled={isSubmitting}
        >
          <i className="fas fa-arrow-left"></i>
        </button>
        <h1 className="absolute left-1/2 transform -translate-x-1/2 text-xl lg:text-2xl font-bold">
          Pesanan
        </h1>
      </header>

      <main className="flex-grow lg:px-8">
        {/* User Information - Optimized rendering */}
        <div className="p-4">
          <div className="flex">
            <i className="fas fa-map-marker-alt text-yellow-300 text-xl mr-4"></i>
            <h2 className="font-semibold mb-2">Alamat Pengiriman</h2>
          </div>
          <div className="space-y-1">
            <p>{userDetails.fullName}</p>
            <p>{userDetails.phoneNumber}</p>
            <p>{fullAddress}</p>
          </div>
        </div>

        <div className="border-t border-gray-200"></div>

        {/* Products - Optimized dengan lazy loading */}
        <div className="p-4">
          <h2 className="font-semibold mb-2">Produk</h2>
          <div className="space-y-2">
            {cartData.map((item) => (
              <div key={item.id} className="p-4 bg-white mb-2 rounded shadow">
                <div className="flex">
                  <img
                    src={item.product.images[0]?.url || "https://placehold.co/100x100"}
                    alt={item.product.name}
                    className="w-20 h-20 object-cover rounded-md"
                    loading="lazy"
                  />
                  <div className="ml-4 flex-grow">
                    <p className="font-semibold line-clamp-2">{item.product.name}</p>
                    <p className="text-gray-600">Size: {item.product.size}</p>
                    <p className="font-semibold mt-2">
                      Rp {item.product.price.toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-end">
                    <p className="text-gray-600">x{item.quantity}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-gray-200"></div>

        {/* Shipping Information */}
        {/* <div className="p-4">
          <h2 className="font-semibold mb-2">Opsi Pengiriman</h2>
          <div className="p-4 border border-gray-400 rounded-md flex justify-between items-center">
            <div className="flex items-center">
              <i className="fas fa-dot-circle text-yellow-300 text-xl"></i>
              <p className="ml-2">Pengiriman Regular</p>
            </div>
            <p>Rp {shippingCost.toLocaleString()}</p>
          </div>
        </div> */}

        <div className="border-t border-gray-200"></div>

        {/* Payment Details */}
        <div className="p-4">
          <h2 className="font-semibold mb-2">Rincian Pembayaran</h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <p>Subtotal untuk Produk</p>
              <p>Rp {subtotal.toLocaleString()}</p>
            </div>
            {/* <div className="flex justify-between">
              <p>Subtotal untuk Pengiriman</p>
              <p>Rp {shippingCost.toLocaleString()}</p>
            </div> */}
            <div className="flex justify-between font-semibold pt-2 border-t">
              <p>Total Pembayaran</p>
              <p>Rp {total.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200"></div>
      </main>

      <footer className="p-4 flex items-center justify-between bg-white border-t border-gray-300">
        <div className="flex items-center"></div>
        <div className="flex">
          <div className="text-right mr-4">
            <p className="text-black text-sm font-semibold">Total Pembayaran</p>
            <p className="text-yellow-300 font-bold text-lg">
              Rp {total.toLocaleString()}
            </p>
          </div>
          <button
            onClick={handleConfirmOrder}
            disabled={isSubmitting}
            className={`${
              isSubmitting 
                ? "bg-gray-300 cursor-not-allowed" 
                : "bg-yellow-300 hover:bg-yellow-400"
            } text-black font-semibold py-2 px-4 rounded-lg transition-colors`}
          >
            {isSubmitting ? "Memproses..." : "Konfirmasi Pesanan"}
          </button>
        </div>
      </footer>
    </div>
  );
}