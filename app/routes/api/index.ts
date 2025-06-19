import { json } from '@remix-run/node';
import { sendOTP } from '../../utils/jwt.server';
import axios from 'axios';

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const email = url.searchParams.get('email');
  const type = url.searchParams.get("type");
  const provinceId = url.searchParams.get("province_id");
  const cityId = url.searchParams.get("city_id");

  if (type === 'otp') {
    // Jika tipe adalah OTP, kirimkan OTP ke email
    if (!email) {
      return json({ error: 'Email is required' }, { status: 400 });
    }

    try {
      const otp = await sendOTP(email); // Kirim OTP
      return json({ otp, message: 'OTP sent successfully' });
    } catch (error) {
      return json({ error: 'Failed to send OTP' }, { status: 500 });
    }
  }

  // Jika tipe bukan OTP, maka ambil data wilayah Indonesia
  let endpoint;

  switch (type) {
    case 'cities':
      if (!provinceId) {
        return json({ error: 'province_id is required for cities' }, { status: 400 });
      }
      endpoint = `https://jasonslav.github.io/api-wilayah-indonesia/api/regencies/${provinceId}.json`;
      break;
    case 'subdistricts':
      if (!cityId) {
        return json({ error: 'city_id is required for subdistricts' }, { status: 400 });
      }
      endpoint = `https://jasonslav.github.io/api-wilayah-indonesia/api/districts/${cityId}.json`;
      break;
    case 'provinces':
    default:
      endpoint = 'https://jasonslav.github.io/api-wilayah-indonesia/api/provinces.json';
  }

  try {
    const response = await axios.get(endpoint);
    return json(response.data);
  } catch (error) {
    console.error('Error fetching data:', error);
    return json({ error: 'Failed to fetch data' }, { status: 500 });
  }
};
