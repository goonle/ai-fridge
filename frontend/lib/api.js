import axios from "axios";

// Set your backend URL in app config or .env
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";
export const api = axios.create({ baseURL: BASE_URL, timeout: 20000 });
