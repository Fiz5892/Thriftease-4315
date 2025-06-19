/*
  Warnings:

  - You are about to drop the column `paymentId` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `productId` on the `SearchScore` table. All the data in the column will be lost.
  - Added the required column `category` to the `SearchScore` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `SearchScore` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "SearchScore" DROP CONSTRAINT "SearchScore_productId_fkey";

-- DropIndex
DROP INDEX "Order_paymentId_key";

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "paymentId";

-- AlterTable
ALTER TABLE "SearchScore" DROP COLUMN "productId",
ADD COLUMN     "category" TEXT NOT NULL,
ADD COLUMN     "userId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "ProductSearch" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "searchScoreId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductSearch_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SearchScore" ADD CONSTRAINT "SearchScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSearch" ADD CONSTRAINT "ProductSearch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSearch" ADD CONSTRAINT "ProductSearch_searchScoreId_fkey" FOREIGN KEY ("searchScoreId") REFERENCES "SearchScore"("id") ON DELETE CASCADE ON UPDATE CASCADE;
