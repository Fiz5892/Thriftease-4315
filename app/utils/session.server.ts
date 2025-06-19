import { createCookieSessionStorage, redirect, json } from "@remix-run/node";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET must be set");
}

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__session",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secrets: [process.env.SESSION_SECRET],
    maxAge: 60 * 60,
    secure: process.env.NODE_ENV === "production",
  },
});

// Utility function to get session and userId
export async function getSession(request: Request) {
  const session = await sessionStorage.getSession(request.headers.get("Cookie"));
  const userId = session.get("userId");
  return { session, userId: typeof userId === "string" ? userId : null, };
}

// Create user session and redirect
export async function createUserSession(userId: string, redirectTo: string) {
  const session = await sessionStorage.getSession();
  session.set("userId", userId);
  return redirect(redirectTo, {
    headers: { "Set-Cookie": await sessionStorage.commitSession(session) },
  });
}

// Get user by session
export async function getUser(request: Request) {
  const { userId } = await getSession(request);
  if (userId) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    return user;
  }
  return null;
}

// Require authenticated user; optionally require admin
export async function requireUser(request: Request, role: string = "") {
  const user = await getUser(request);
  if (!user) throw redirect("/login");
  if (role && user.role !== role) throw json({ message: "Unauthorized" }, { status: 403 });
  return user;
}

export async function requireAdmin(request: Request) {
  const admin = await getUser(request);
  if (!admin || admin.role !== "ADMIN") {
    throw json({ message: "Unauthorized" }, { status: 403 });
  }
  return admin;
}

export async function requireAdminSession(request: Request) {
  const { userId } = await getSession(request);
  if (!userId) {
    throw redirect("/admin/login");
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw redirect("/admin/login");
}

  if (!user || user.role !== "ADMIN") {
    throw redirect("/admin/login");
  }

  return user;
}

// Logout and destroy session
export async function logout(request: Request) {
  const session = await sessionStorage.getSession(request.headers.get("Cookie"));
  return redirect("/login", {
    headers: { "Set-Cookie": await sessionStorage.destroySession(session) },
  });
}