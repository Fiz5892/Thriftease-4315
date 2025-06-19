import { json } from "@remix-run/node";
import { Link, Outlet, useLoaderData, Form } from "@remix-run/react";
import type { ActionFunctionArgs } from "@remix-run/node";
import { logout } from "~/utils/session.server";
import { AdminSidebar } from "~/routes/components/AdminSidebar";
import type { User } from "@prisma/client";

// export const loader = async ({ request }: LoaderFunctionArgs) => {
//   const admin = await requireAdmin(request);
//   return json({ currentUser: admin });
// };

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method.toLowerCase() !== 'post') {
    return json({ message: "Method not allowed" }, { status: 405 });
  }
  return logout(request);
};

export default function AdminLayout() {
  const { currentUser } = useLoaderData<{ currentUser: User | null }>();

  if (!currentUser) {
    return <div>User not found!</div>;
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <AdminSidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6">
          <Outlet />
        </div>
        <div className="h-16">
          <Link to="/admin/login">Admin Login</Link>
        </div>
        <div className="p-6">
          <Form method="post">
            <button type="submit">Logout</button>
          </Form>
        </div>
      </main>
    </div>
  );
}