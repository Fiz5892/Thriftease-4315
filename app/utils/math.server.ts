export function calculateCosineSimilarity(vectorA: number[], vectorB: number[]): number {
    if (vectorA.length !== vectorB.length) {
      throw new Error('Vectors must be of same length');
    }
  
    const dotProduct = vectorA.reduce((acc, val, i) => acc + val * vectorB[i], 0);
    const magnitudeA = Math.sqrt(vectorA.reduce((acc, val) => acc + val * val, 0));
    const magnitudeB = Math.sqrt(vectorB.reduce((acc, val) => acc + val * val, 0));
  
    return dotProduct / (magnitudeA * magnitudeB);
  }
  
  export function calculateTFIDF(term: string, document: string, allDocuments: string[]): number {
    // Term Frequency
    const tf = document.split(' ').filter(word => word === term).length;
    
    // Inverse Document Frequency
    const documentsWithTerm = allDocuments.filter(doc => doc.includes(term)).length;
    const idf = Math.log(allDocuments.length / (documentsWithTerm + 1));
    
    return tf * idf;
  }
  
  export function normalizeScore(score: number, min: number, max: number): number {
    return (score - min) / (max - min);
  }
  
  export function weightedAverage(scores: Array<{ value: number; weight: number }>): number {
    const totalWeight = scores.reduce((sum, item) => sum + item.weight, 0);
    const weightedSum = scores.reduce((sum, item) => sum + item.value * item.weight, 0);
    return weightedSum / totalWeight;
  }