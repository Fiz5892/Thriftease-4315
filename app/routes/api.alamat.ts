import axios from "axios";

const RAJA_ONGKIR_API_KEY = "73f159380fd4831edfd8ab1f150ff2c0"; // Ganti dengan API Key Anda
const RAJA_ONGKIR_BASE_URL = "https://api.rajaongkir.com/starter";

/**
 * Fetch province, city, or district name by ID.
 * @param {string} endpoint - The endpoint (e.g., "province", "city", "subdistrict").
 * @param {number} id - The ID to look up.
 * @returns {Promise<string>} The name of the province, city, or district.
 */
export const getRajaOngkirNameById = async (endpoint: string, id: number): Promise<string> => {
  try {
    const response = await axios.get(`${RAJA_ONGKIR_BASE_URL}/${endpoint}`, {
      params: { id },
      headers: { key: RAJA_ONGKIR_API_KEY },
    });
    const data = response.data.rajaongkir.results;
    return data.name || data.city_name || data.subdistrict_name;
  } catch (error) {
    console.error("Error fetching data from Raja Ongkir:", error);
    throw new Error("Failed to fetch location name.");
  }
};
