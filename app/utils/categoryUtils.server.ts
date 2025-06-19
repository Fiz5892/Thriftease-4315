export async function updateCategoryScore(userId: string, category: string) {
    const searchScore = await prisma.searchScore.findFirst({
      where: { userId, category },
    });
  
    if (searchScore) {
      await prisma.searchScore.update({
        where: { id: searchScore.id },
        data: { score: { increment: 1 } },
      });
    } else {
      await prisma.searchScore.create({
        data: { userId, category, score: 1 },
      });
    }
  }
  
  export function determineCategory(query: string): string {
    if (query.toLowerCase().includes("baju")) return "Baju";
    if (query.toLowerCase().includes("celana")) return "Celana";
    if (query.toLowerCase().includes("sepatu")) return "Sepatu";
    if (query.toLowerCase().includes("jaket")) return "Jaket";
    if (query.toLowerCase().includes("topi")) return "Topi";
    if (query.toLowerCase().includes("kaos")) return "T-Shirt";
    if (query.toLowerCase().includes("dress")) return "Dress";
    if (query.toLowerCase().includes("rok")) return "Rok";
    return "Lainnya";
  }
  