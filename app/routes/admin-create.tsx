import { Form, useActionData, redirect } from "@remix-run/react";
import { json, type ActionFunctionArgs } from "@remix-run/node";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const username = formData.get("username");
  const email = formData.get("email");
  const password = formData.get("password");

  // Type guards to ensure we have valid string values
  if (!username || !email || !password) {
    return json({ error: "All fields are required" }, { status: 400 });
  }

  const hashedPassword = await bcrypt.hash(password.toString(), 10);
  
  try {
    await prisma.user.create({
      data: {
        username: username.toString(),
        email: email.toString(),
        password: hashedPassword,
        role: "ADMIN",
        fullName: 'Admin',
        phoneNumber: '',
        isVerified: true,
        province: '1',
        city: '1',
        district: '1',
        postalCode: '1',
        address: '1',
      },
    });
    
    return redirect(`/`);
  } catch (error) {
    return json({ error: "Failed to create admin user" }, { status: 500 });
  }
};

export default function CreateAdmin() {
  const actionData = useActionData<typeof action>();

  return (
    <div>
      <h1>Create Admin</h1>
      <Form method="post">
        <label>
          Username:
          <input type="text" name="username" required />
        </label>
        <label>
          Email:
          <input type="email" name="email" required />
        </label>
        <label>
          Password:
          <input type="password" name="password" required />
        </label>
        <button type="submit">Create Admin</button>
      </Form>
      {actionData?.error && (
        <div style={{ color: 'red', marginTop: '1rem' }}>
          {actionData.error}
        </div>
      )}
    </div>
  );
}