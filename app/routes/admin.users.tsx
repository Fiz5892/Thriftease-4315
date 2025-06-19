import { PrismaClient, User, Role } from "@prisma/client";
import { LoaderFunction, json, ActionFunction } from "@remix-run/node";
import { requireAdmin } from "~/utils/session.server";
import bcrypt from "bcryptjs";

// Initialize Prisma client at the top
const prisma = new PrismaClient();

export const action: ActionFunction = async ({ request }) => {
  await requireAdmin(request);
  const formData = await request.formData();
  const email = formData.get("email") as string;
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;
  const fullName = formData.get("fullName") as string;
  const address = formData.get("address") as string;
  const role = formData.get("role") as Role; // Cast to Role enum type
  const phoneNumber = formData.get("phoneNumber") as string;
  const province = formData.get("province") as string;
  const city = formData.get("city") as string;
  const district = formData.get("district") as string;
  const postalCode = formData.get("postalCode") as string;
  const id = formData.get("id") as string;
  const action = formData.get("_action") as string;

  switch (action) {
    case "delete": {
      await prisma.user.delete({
        where: {
          id: id,
        },
      });
      break;
    }
    case "create": {
      const hashedPassword = await bcrypt.hash(password, 10);
      await prisma.user.create({
        data: {
          email,
          username,
          password: hashedPassword,
          fullName,
          address,
          role,
          phoneNumber,
          province,
          city,
          district,
          postalCode,
        },
      });
      break;
    }
    case "update": {
      const hashedPassword = await bcrypt.hash(password, 10);
      await prisma.user.update({
        where: {
          id: id,
        },
        data: {
          email,
          username,
          password: hashedPassword,
          fullName,
          address,
          role,
          phoneNumber,
          province,
          city,
          district,
          postalCode,
        },
      });
      break;
    }
  }
  
  return json({ success: true });
};

export const loader: LoaderFunction = async ({ request }) => {
  await requireAdmin(request);
  const users = await prisma.user.findMany({
    take: 100,
    skip: 0,
    select: {
      id: true,
      username: true,
      email: true,
      password: false,
      fullName: true,
      address: true,
      phoneNumber: true,
      province: true,
      city: true,
      district: true,
      postalCode: true,
      createdAt: true,
      role: true
    }
  });
  return json({ users });
};

// Fixed component to handle array of users
export function UsersTable({ users }: { users: User[] }) {
  return (
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            Username
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            Email
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            Nama Lengkap
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            Alamat
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            Provinsi
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            Kota
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            Role
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            Tanggal Dibuat
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
            Actions
          </th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {users.map((user) => (
          <tr key={user.id}>
            <td className="px-6 py-4 whitespace-nowrap">
              <div className="text-sm text-gray-900">{user.username}</div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap">
              <div className="text-sm text-gray-900">{user.email}</div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap">
              <div className="text-sm text-gray-900">{user.fullName}</div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap">
              <div className="text-sm text-gray-900">{user.address}</div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap">
              <div className="text-sm text-gray-900">{user.province}</div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap">
              <div className="text-sm text-gray-900">{user.city}</div>
            </td>
            <td className="px-6 py-4 whitespace-nowrap">
              <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                {user.role}
              </span>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
              <button className="text-indigo-600 hover:text-indigo-900 mr-3">
                Edit
              </button>
              <button className="text-red-600 hover:text-red-900">
                Delete
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Alternative: If you need to validate role before casting
export function validateRole(role: string): Role {
  const validRoles = Object.values(Role);
  if (validRoles.includes(role as Role)) {
    return role as Role;
  }
  throw new Error(`Invalid role: ${role}`);
}

