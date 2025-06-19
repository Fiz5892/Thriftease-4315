import { Form, useActionData } from "@remix-run/react";
import { json, redirect } from "@remix-run/node";
import type { ActionFunction, LoaderFunction } from "@remix-run/node";
import { authenticator } from "~/utils/auth.server";
import { sessionStorage } from "~/utils/session.server";
import { useState } from "react";

export const loader: LoaderFunction = async ({ request }) => {
  const user = await authenticator.isAuthenticated(request);
  if (user && user.role === "ADMIN") {
    return redirect("/admin/dashboard");
  }
  return null;
};

export const action: ActionFunction = async ({ request }) => {
  try {
    const user = await authenticator.authenticate("form", request, {
      failureRedirect: "/admin/login",
    });

    if (user.role !== "ADMIN") {
      throw new Error("Unauthorized");
    }

    const session = await sessionStorage.getSession();
    session.set("userId", user.id);
    session.set("userRole", user.role);

    return redirect("/admin-menu", {
      headers: {
        "Set-Cookie": await sessionStorage.commitSession(session),
      },
    });
  } catch (error) {
    return json({ error: "Invalid login credentials" }, { status: 401 });
  }
};

export default function AdminLogin() {
  const actionData = useActionData<{ error?: string }>();
  const [showPassword, setShowPassword] = useState(false);

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center w-full max-w-md p-4">
        <div className="mb-8">
          <img src="/app/foto/ri_admin-fill.png" alt="Logo Admin" />
        </div>
        <h1 className="text-2xl font-bold mb-6">Admin Login</h1>

        {actionData?.error && (
          <div className="rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-700">{actionData.error}</p>
          </div>
        )}

        <Form method="post" className="w-full mb-4">
          <div>
            <div className="flex items-center border border-black rounded-lg p-2 mb-4">
              <label htmlFor="login" className="sr-only">
                Email or Username
              </label>
              <input
                id="login"
                name="login"
                type="text"
                required
                className="flex-1 outline-none text-gray-500"
                placeholder="Email or Username"
              />
            </div>
            <div className="flex items-center border border-black rounded-lg p-2 mb-4">
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                className="flex-1 outline-none text-gray-500"
                placeholder="Password"
              />
              <button
                type="button"
                onClick={togglePasswordVisibility}
                className="ml-2 text-gray-500 hover:text-gray-700"
                aria-label="Toggle password visibility"
              >
                <i
                  className={`fas ${
                    showPassword ? "fa-eye-slash" : "fa-eye"
                  }`}
                ></i>
              </button>
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="w-full bg-yellow-300 text-black font-bold py-2 rounded-lg mb-6 shadow-lg"
            >
              Login
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}
