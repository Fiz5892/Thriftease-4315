// Importasi library dan komponen yang dibutuhkan
import { useLoaderData, Form } from "@remix-run/react";
import { json } from "@remix-run/node";
import type { LoaderFunction, ActionFunction } from "@remix-run/node";
import { requireAdmin } from "~/utils/session.server";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// Instansiasi Prisma Client
const prisma = new PrismaClient();

// Fungsi loader untuk mengambil data admin
export const loader: LoaderFunction = async ({ request }) => {
  try {
    await requireAdmin(request);
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN" },
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        createdAt: true,
      },
    });
    return json({ admins });
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }
    return json({ error: "An error occurred" }, { status: 500 });
  }
};

// Fungsi action untuk menghandle form submission
export const action: ActionFunction = async ({ request }) => {
  // Verifikasi apakah user adalah admin
  await requireAdmin(request);

  // Ambil data form dari request
  const form = await request.formData();
  const action = form.get("_action");

  // Handle action type
  switch (action) {
    case "create": {
      // Ambil data form untuk create admin
      const email = form.get("email") as string;
      const username = form.get("username") as string;
      const password = form.get("password") as string;
      const fullName = form.get("fullName") as string;

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Buat admin baru
      await prisma.user.create({
        data: {
          email,
          username,
          password: hashedPassword,
          fullName,
          role: "ADMIN",
          province: "", // Provide appropriate default or form value
          city: "",
          district: "",
          postalCode: "",
          address: "", // Add any other required fields here
          phoneNumber: "" // Provide appropriate default or form value
        }
      });

      // Kembalikan respon sukses
      return json({ success: true });
    }
    case "delete": {
      // Ambil data form untuk delete admin
      const id = form.get("id") as string;

      // Cek apakah admin terakhir
      const adminCount = await prisma.user.count({
        where: { role: "ADMIN" }
      });

      // Jika admin terakhir, kembalikan respon error
      if (adminCount <= 1) {
        return json(
          { error: "Cannot delete the last admin" },
          { status: 400 }
        );
      }

      // Hapus admin
      await prisma.user.delete({
        where: { id }
      });

      // Kembalikan respon sukses
      return json({ success: true });
    }
    default:
      // Jika action type tidak valid, kembalikan respon error
      return json({ error: "Invalid action" }, { status: 400 });
  }
};

// Komponen ManageAdmins
export default function ManageAdmins() {
  // Ambil data admin dari loader
  type Admin = {
    id: number;
    email: string;
    username: string;
    fullName: string;
    createdAt: Date;
  };

  const { admins } = useLoaderData<{ admins?: Admin[] }>();

  // Render komponen
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Manage Administrators</h1>

      {/* Form tambah admin */}
      <div className="mb-8 p-6 bg-white rounded-lg shadow">
        <h2 className="text-lg font-semibold mb-4">Add New Admin</h2>
        <Form method="post" className="space-y-4">
          <input type="hidden" name="_action" value="create" />
          {/* Input form untuk tambah admin */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              name="email"
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          {/* ... */}
        </Form>
      </div>

      {/* Tabel daftar admin */}
      <div className="bg-white shadow rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Username
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created At
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {admins && admins.length > 0 ? (
              admins.map((admin) => (
                <tr key={admin.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {admin.fullName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {admin.username}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {admin.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {new Date(admin.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <Form method="post" className="inline">
                      <input type="hidden" name="_action" value="delete" />
                      <input type="hidden" name="id" value={admin.id} />
                      <button
                        type="submit"
                        className="text-red-600 hover:text-red-900"
                        onClick={(e) => {
                          if (!confirm("Are you sure you want to delete this admin?")) {
                            e.preventDefault();
                          }
                        }}
                      >
                        Delete
                      </button>
                    </Form>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center">
                  No admins found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}