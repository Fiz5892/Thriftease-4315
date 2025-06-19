import { MidtransClient } from "midtrans-node-client";
import { Order as PrismaOrder } from "@prisma/client";

interface Order extends PrismaOrder {
  user: {
    fullName: string;
    email: string;
    phoneNumber: string;
  };
}

const core = new MidtransClient.CoreApi({
  isProduction: process.env.NODE_ENV === "production",
  serverKey: process.env.MIDTRANS_SERVER_KEY,
  clientKey: process.env.MIDTRANS_CLIENT_KEY
});

export async function createPayment(order: Order) {
  const parameter = {
    transaction_details: {
      order_id: order.id,
      gross_amount: order.totalAmount
    },
    credit_card: {
      secure: true
    },
    customer_details: {
      first_name: order.user.fullName,
      email: order.user.email,
      phone: order.user.phoneNumber
    }
  };

  const transaction = await core.charge(parameter);
  return transaction.token;
}