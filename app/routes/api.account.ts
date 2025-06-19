import { json, ActionFunction } from "@remix-run/node";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
export const action: ActionFunction = async ({ request }) => {
    const formData = new URLSearchParams(await request.text());
    const userId = formData.get("id");

    if (!userId) {
        return json({ error: "User ID is required" }, { status: 400 });
    }

    const username = formData.get("username");
    const email = formData.get("email");
    const phoneNumber = formData.get("phone");
    const fullName = formData.get("name");
    const address = formData.get("address");
    const province = formData.get("province");
    const city = formData.get("city");
    const district = formData.get("district");

    if (!username || !email || !phoneNumber || !fullName || !address || !province || !city || !district) {
        return json({ error: "All fields are required" }, { status: 400 });
    }
    
    try {
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { username, fullName, email, phoneNumber, address, province, city, district },
        });
        return json({ message: "User updated successfully", user: updatedUser });
    } catch (error) {
        console.error(error);
        return json({ error: "Failed to update user" }, { status: 500 });
    }
};

export default { action };