import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const saveSearchAndUpdateScore = async (userId: string, query: string) => {
  // Tentukan kategori dari query
  const category = identifyCategory(query);

  // Simpan pencarian
  await prisma.search.create({
    data: { userId, query },
  });

  // Perbarui atau buat skor kategori
  const existingScore = await prisma.searchScore.findFirst({
    where: { userId, category },
  });

  if (existingScore) {
    await prisma.searchScore.update({
      where: { id: existingScore.id },
      data: { score: existingScore.score + 1 },
    });
  } else {
    await prisma.searchScore.create({
      data: { userId, category, score: 1 },
    });
  }
};

// Fungsi untuk menentukan kategori berdasarkan query
const identifyCategory = (query: string): string => {
  if (query.toLowerCase().includes("sepatu")) return "Sepatu";
  if (query.toLowerCase().includes("kemeja")) return "Kemeja";
  return "Lainnya";
};

export const getRecommendedProducts = async (userId: string) => {
  const topCategory = await prisma.searchScore.findFirst({
    where: { userId },
    orderBy: { score: "desc" },
  });

  const products = await prisma.product.findMany({
    orderBy: [
      { category: topCategory?.category === "Sepatu" ? "desc" : "asc" },
      { createdAt: "desc" },
    ],
    include: { images: true },
    take: 20,
  });

  return products;
};
