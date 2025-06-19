import { json } from "@remix-run/node";
import type { ActionFunction, LoaderFunction } from "@remix-run/node";
import { prisma } from "~/utils/prisma.server";

// Loader untuk menangani GET /api/users
export const loader: LoaderFunction = async () => {
  const users = await prisma.user.findMany();
  return json(users);
};

// Action untuk menangani POST, PUT, dan DELETE
export const action: ActionFunction = async ({ request }) => {
  const method = request.method.toUpperCase();
  const body = await request.json();

  switch (method) {
    case "POST": {
      const { username, email, fullName, phoneNumber, password } = body;

      const newUser = await prisma.user.create({
        data: { username, email, fullName, phoneNumber, password, role: "USER", isVerified: true, province: '1', city: '1', district: '1', postalCode: '1', address: '1' },
      });

      return json(newUser);
    }

    case "PUT": {
      const { id, username, email, fullName, phoneNumber } = body;

      const updatedUser = await prisma.user.update({
        where: { id },
        data: { username, email, fullName, phoneNumber },
      });

      return json(updatedUser);
    }

    case "DELETE": {
      const { id } = body;

      await prisma.user.delete({
        where: { id },
      });

      return json({ message: "User deleted successfully" });
    }

    default:
      return json({ error: "Method not allowed" }, { status: 405 });
  }
};
