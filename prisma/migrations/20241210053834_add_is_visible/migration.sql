/*
  Warnings:

  - You are about to drop the `ProductSearch` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ProductSearch" DROP CONSTRAINT "ProductSearch_productId_fkey";

-- DropForeignKey
ALTER TABLE "ProductSearch" DROP CONSTRAINT "ProductSearch_searchScoreId_fkey";

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "isVisible" BOOLEAN NOT NULL DEFAULT true;

-- DropTable
DROP TABLE "ProductSearch";
