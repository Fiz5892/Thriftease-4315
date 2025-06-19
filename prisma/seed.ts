import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Fetch the first 6 products (adjust `take` if you want more/less)
  const products = await prisma.product.findMany({
    take: 6, // Limit to 6 products
  });

  // Map over products and create images
  const productImages = products.map((product, index) => ({
    url: `app/foto/product-${index + 1}.jpg`, // Example image URLs
    productId: product.id, // Use the product's ID
  }));

  // Insert product images into the database
  await prisma.productImage.createMany({
    data: productImages,
  });

  console.log("Seeded 6 entries into the ProductImage table");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
