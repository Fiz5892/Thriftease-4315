import { json, redirect } from "@remix-run/node";
import { prisma } from "~/utils/prisma.server";
import { useLoaderData, Form, useNavigate, useFetcher } from "@remix-run/react";
import { authenticator } from "~/utils/auth.server";
import { useState, useCallback, useMemo } from "react";
import { saveTemporaryOrder } from "~/utils/orders.server";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request);
  if (!user) return redirect("/login");

  // Optimized: Single query with all necessary joins
  const cart = await prisma.cart.findUnique({
    where: { userId: user.id },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              price: true,
              size: true,
              stock: true,
              images: {
                select: { url: true },
                take: 1 // Only get first image to reduce data transfer
              }
            }
          }
        }
      }
    }
  });

  return json({ cart: cart || { items: [] } });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const actionType = formData.get("action");
  const user = await authenticator.isAuthenticated(request);

  if (!user) return redirect("/login");

  if (actionType === "checkout") {
    const cartDataRaw = formData.get("cartData");
    if (!cartDataRaw) return redirect("/cart");
    
    try {
      const cartData = JSON.parse(cartDataRaw as string);
      const shippingCost = 15000;
      
      // Optimized: Calculate total more efficiently
      const subtotal = cartData.reduce(
        (sum: number, item: { product: { price: number }; quantity: number }) =>
          sum + (item.product.price * item.quantity),
        0
      );

      const orderData = {
        user,
        cartData,
        shippingCost,
        total: subtotal + shippingCost,
      };

      // Optimized: Save order data without blocking
      await saveTemporaryOrder(user.id, orderData);
      return redirect("/pesanan");
    } catch (error) {
      console.error("Checkout error:", error);
      return json({ error: "Checkout failed" }, { status: 500 });
    }
  }

  if (actionType === "updateQuantity") {
    const itemId = formData.get("itemId");
    const quantity = parseInt(formData.get("quantity") as string, 10);

    if (typeof itemId !== "string" || isNaN(quantity) || quantity <= 0) {
      return redirect("/cart");
    }

    try {
      // Optimized: Single query with validation
      const cartItem = await prisma.cartItem.findUnique({
        where: { id: itemId },
        select: {
          id: true,
          product: {
            select: { stock: true }
          }
        }
      });

      if (cartItem && quantity <= cartItem.product.stock) {
        await prisma.cartItem.update({
          where: { id: itemId },
          data: { quantity }
        });
      }
    } catch (error) {
      console.error("Update quantity error:", error);
    }

    return redirect("/cart");
  }

  if (actionType === "removeItem") {
    const itemId = formData.get("itemId");
    if (typeof itemId !== "string") return redirect("/cart");
    
    try {
      await prisma.cartItem.delete({
        where: { id: itemId }
      });
    } catch (error) {
      console.error("Remove item error:", error);
    }

    return redirect("/cart");
  }

  // Optimized: Batch remove multiple items
  if (actionType === "removeBatch") {
    const itemIds = JSON.parse(formData.get("itemIds") as string);
    
    try {
      await prisma.cartItem.deleteMany({
        where: { 
          id: { in: itemIds },
          cart: { userId: user.id }
        }
      });
    } catch (error) {
      console.error("Batch remove error:", error);
    }

    return redirect("/cart");
  }

  return redirect("/cart");
};

// Frontend Types
type CartItem = {
  id: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    price: number;
    size: string;
    stock: number;
    images: { url: string }[];
  };
};

type LoaderData = {
  cart: {
    items: CartItem[];
  };
};

export default function CartPage() {
  const { cart } = useLoaderData<LoaderData>();
  const navigate = useNavigate();
  const fetcher = useFetcher();
  
  // Optimized: Initialize state more efficiently
  const [selectedItems, setSelectedItems] = useState(() => 
    new Array(cart.items.length).fill(false)
  );
  const [selectAll, setSelectAll] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  // Optimized: Memoized calculations
  const selectedItemsData = useMemo(() => {
    return cart.items.filter((_, index) => selectedItems[index]);
  }, [cart.items, selectedItems]);

  const selectedTotal = useMemo(() => {
    return selectedItemsData
      .reduce((total, item) => total + item.product.price * item.quantity, 0)
      .toLocaleString("id-ID");
  }, [selectedItemsData]);

  const hasSelectedItems = useMemo(() => {
    return selectedItems.some(item => item);
  }, [selectedItems]);

  // Optimized: Callback functions to prevent re-renders
  const handleItemChange = useCallback((index: number) => {
    setSelectedItems(prev => {
      const updated = [...prev];
      updated[index] = !updated[index];
      
      // Update select all state
      const allChecked = updated.every(item => item);
      setSelectAll(allChecked);
      
      return updated;
    });
  }, []);

  const handleSelectAllChange = useCallback(() => {
    const newState = !selectAll;
    setSelectAll(newState);
    setSelectedItems(prev => prev.map(() => newState));
  }, [selectAll]);

  // Optimized: Batch remove with single request
  const handleRemoveSelected = useCallback(() => {
    if (!hasSelectedItems) return;
    setShowConfirmModal(true);
  }, [hasSelectedItems]);

  const confirmRemoveItems = useCallback(async () => {
    const itemIds = selectedItemsData.map(item => item.id);
    
    fetcher.submit(
      {
        action: "removeBatch",
        itemIds: JSON.stringify(itemIds)
      },
      { method: "post" }
    );
    
    setShowConfirmModal(false);
  }, [selectedItemsData, fetcher]);

  // Optimized: Streamlined checkout process
  const handleCheckout = useCallback(async () => {
    if (!hasSelectedItems || cart.items.length === 0 || isCheckingOut) {
      return;
    }

    setIsCheckingOut(true);

    try {
      fetcher.submit(
        {
          action: "checkout",
          cartData: JSON.stringify(selectedItemsData)
        },
        { method: "post" }
      );
    } catch (error) {
      console.error("Checkout error:", error);
      setIsCheckingOut(false);
    }
  }, [hasSelectedItems, cart.items.length, isCheckingOut, selectedItemsData, fetcher]);

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      {/* Header */}
      <header className="flex items-center justify-between border-b pb-2 lg:pb-4 mb-4 lg:mb-6 w-full px-4 lg:px-8 bg-white pt-4">
        <button
          onClick={() => navigate(-1)}
          className="w-8 h-8 lg:w-10 lg:h-10 bg-yellow-300 rounded-full flex items-center justify-center"
        >
          <i className="fas fa-arrow-left"></i>
        </button>
        <h1 className="text-xl lg:text-2xl font-bold">Keranjang</h1>
        <button
          onClick={handleRemoveSelected}
          disabled={!hasSelectedItems}
          className={`text-2xl ${
            hasSelectedItems ? "text-yellow-300" : "text-gray-400"
          }`}
        >
          <i className="fas fa-trash"></i>
        </button>
      </header>

      <div className="w-full max-w-md lg:max-w-full mx-auto p-4 lg:p-8 flex-grow lg:px-16 md:max-w-3xl">
        <main className="p-4 flex-grow md:px-8">
          {cart?.items?.length === 0 ? (
            <p className="text-gray-600 text-center font-bold text-sm md:text-base">
              Keranjang Anda kosong.
            </p>
          ) : (
            cart.items.map((item, index) => (
              <div
                key={item.id}
                className="bg-white shadow-lg rounded-lg p-4 flex items-center mb-4 md:space-x-4 space-x-2"
              >
                {/* Checkbox */}
                <input
                  type="checkbox"
                  className="form-checkbox text-yellow-300 h-4 w-4 md:h-5 md:w-5 mr-2 md:mr-4"
                  checked={selectedItems[index] || false}
                  onChange={() => handleItemChange(index)}
                />

                {/* Product Image and Details */}
                <div className="flex-shrink-0">
                  <img
                    src={item.product.images[0]?.url || "/placeholder.png"}
                    alt={item.product.name}
                    className="w-16 h-16 md:w-20 md:h-20 object-contain rounded-md"
                    loading="lazy"
                  />
                </div>
                <div className="ml-2 md:ml-4 flex-grow">
                  <p className="font-semibold text-sm md:text-base line-clamp-1 overflow-hidden text-ellipsis">
                    {item.product.name}
                  </p>
                  <p className="text-gray-500 text-xs md:text-sm">
                    Size: {item.product.size}
                  </p>
                  <p className="font-semibold text-yellow-300 text-sm md:text-base">
                    Rp. {item.product.price.toLocaleString()}
                  </p>
                  <div className="flex items-center space-x-2 mt-2 float-end">
                    <Form method="post" className="flex items-center space-x-2">
                      <input type="hidden" name="itemId" value={item.id} />
                      <input type="hidden" name="action" value="updateQuantity" />
                      <button
                        type="submit"
                        name="quantity"
                        value={item.quantity - 1}
                        className="w-6 h-6 md:w-8 md:h-8 bg-yellow-300 text-white rounded-full flex items-center justify-center"
                        disabled={item.quantity <= 1}
                      >
                        <p className="justify-center items-center font-bold text-xs md:text-lg">
                          -
                        </p>
                      </button>
                      <span className="px-2 py-1 border border-gray-300 rounded-md text-xs md:text-sm">
                        {item.quantity}
                      </span>
                      <button
                        type="submit"
                        name="quantity"
                        value={item.quantity + 1}
                        className="w-6 h-6 md:w-8 md:h-8 bg-yellow-300 text-white rounded-full flex items-center justify-center"
                        disabled={item.quantity >= item.product.stock}
                      >
                        <p className="justify-center items-center font-bold text-xs md:text-lg">
                          +
                        </p>
                      </button>
                    </Form>
                  </div>
                </div>
              </div>
            ))
          )}
        </main>
      </div>

      <footer className="sticky bottom-0 bg-white p-4 flex items-center justify-between">
        <div className="flex items-center">
          <input
            type="checkbox"
            checked={selectAll}
            onChange={handleSelectAllChange}
          />
          <span className="ml-2">Pilih Semua</span>
        </div>
        <div className="flex">
          <div className="text-right mr-4 font-bold items-center flex">
            <p className="text-sm md:text-base">Total: Rp. {selectedTotal}</p>
          </div>

          <button
            className={`${
              hasSelectedItems && cart.items.length > 0 && !isCheckingOut
                ? "bg-yellow-300"
                : "bg-gray-300 cursor-not-allowed"
            } py-2 px-4 rounded`}
            disabled={
              cart.items.length === 0 || !hasSelectedItems || isCheckingOut
            }
            onClick={handleCheckout}
          >
            <p className="font-semibold">
              {isCheckingOut ? "Processing..." : 
                `Checkout (${selectedItems.filter(isSelected => isSelected).length})`
              }
            </p>
          </button>
        </div>
      </footer>
      
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4 text-gray-700">
              Konfirmasi Hapus
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              Apakah Anda yakin ingin menghapus {selectedItemsData.length} item yang dipilih dari keranjang?
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded"
              >
                Batal
              </button>
              <button
                onClick={confirmRemoveItems}
                className="bg-red-500 text-white px-4 py-2 rounded"
                disabled={fetcher.state === "submitting"}
              >
                {fetcher.state === "submitting" ? "Menghapus..." : "Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}