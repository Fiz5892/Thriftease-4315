import { json, ActionFunction, LoaderFunction } from "@remix-run/node";
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  
  if (id) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: { images: true },
    });
    return json({ product });
  }
  
  const products = await prisma.product.findMany({
    include: { images: true },
  });
  return json({ products });
};

export const action: ActionFunction = async ({ request }) => {
  const method = request.method;
  const formData = await request.formData();
  
  switch (method) {
    case "POST": {
      // Tambah Produk
      const name = formData.get("name") as string;
      const description = formData.get("description") as string;
      const size = formData.get("size") as string;
      const price = parseFloat(formData.get("price") as string);
      const stock = parseInt(formData.get("stock") as string);
      const category = formData.get("category") as string;
      const images = formData.getAll("images[]") as File[];
      
      const imageUrls: string[] = [];
      
      if (images.length > 0) {
        for (const image of images) {
          const fileName = `${Date.now()}-${image.name}`;
          const filePath = path.join(process.cwd(), "public", "uploads", fileName);
          const buffer = Buffer.from(await image.arrayBuffer());
          await fs.promises.writeFile(filePath, buffer);
          imageUrls.push(`/uploads/${fileName}`);
        }
      }
      
      const product = await prisma.product.create({
        data: {
          name,
          description,
          size,
          price,
          stock,
          category,
          images: {
            create: imageUrls.map((url) => ({ url })),
          },
        },
      });
      
      return json({ product });
    }
    
    case "PUT": {
      // Update Produk
      const id = formData.get("id") as string;
      const name = formData.get("name") as string;
      const description = formData.get("description") as string;
      const size = formData.get("size") as string;
      const price = parseFloat(formData.get("price") as string);
      const stock = parseInt(formData.get("stock") as string);
      const category = formData.get("category") as string;
   
      if (!id) {
        return json({ error: "ID is required" }, { status: 400 });
      }
   
      // Proses gambar baru (jika ada)
      const images = formData.getAll("images[]") as File[];
      const imageUrls: string[] = [];
   
      if (images.length > 0) {
        for (const image of images) {
          const fileName = `${Date.now()}-${image.name}`;
          const filePath = path.join(process.cwd(), "public", "uploads", fileName);
          const buffer = Buffer.from(await image.arrayBuffer());
          await fs.promises.writeFile(filePath, buffer);
          imageUrls.push(`/uploads/${fileName}`);
        }
      }
   
      // Update produk di database
      const updatedProduct = await prisma.product.update({
        where: { id },
        data: {
          name,
          description,
          size,
          price,
          stock,
          category,
        },
      });

      // Tambahkan gambar baru tanpa menghapus yang lama
      if (imageUrls.length > 0) {
        await prisma.productImage.createMany({
          data: imageUrls.map((url) => ({
            url,
            productId: id,
          })),
        });
      }
   
      return json({ product: updatedProduct });
    }
    
    case "DELETE": {
      // Hapus Produk
      const id = formData.get("id") as string;
      
      // Hapus file gambar dari storage sebelum menghapus produk
      const product = await prisma.product.findUnique({
        where: { id },
        include: { images: true },
      });
      
      if (product) {
        // Hapus file gambar dari folder uploads
        for (const image of product.images) {
          const filePath = path.join(process.cwd(), "public", image.url);
          try {
            await fs.promises.unlink(filePath);
          } catch (error) {
            console.error(`Failed to delete file: ${filePath}`, error);
          }
        }
      }
      
      await prisma.product.delete({
        where: { id },
      });
      
      return json({ success: true });
    }
    
    default:
      return json({ error: "Method not allowed" }, { status: 405 });
  }
};