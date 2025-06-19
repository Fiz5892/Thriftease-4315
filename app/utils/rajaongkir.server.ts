import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const API_KEY = process.env.RAJAONGKIR_API_KEY;
const RAJAONGKIR_BASE_URL = "https://api.rajaongkir.com/starter/";

export const calculateShippingCost = async (originCityId, destinationCityId, weight) => {
  console.log("Request Data:", {
    origin: originCityId,
    destination: destinationCityId,
    weight: weight.toString(),
    courier: "jne",
  });

  const response = await fetch(`${RAJAONGKIR_BASE_URL}cost`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      key: API_KEY,
    },
    body: new URLSearchParams({
      origin: originCityId,
      destination: destinationCityId,
      weight: weight.toString(),
      courier: "jne",
    }),
  });

  if (!response.ok) {
    const errorData = await response.text(); // Respons untuk debugging
    console.error("Error response:", errorData);
    throw new Error(`HTTP error! Status: ${response.status}`);
  }

  const data = await response.json();

  if (data.rajaongkir.status.code !== 200) {
    throw new Error(data.rajaongkir.status.description);
  }

  return data.rajaongkir.results[0].costs;
};
