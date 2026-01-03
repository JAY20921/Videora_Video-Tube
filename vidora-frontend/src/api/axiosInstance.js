import axios from "axios";

const instance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE
  ? `${import.meta.env.VITE_API_BASE}`
  : "http://localhost:8000/api/v1",
  withCredentials: true,
});

export default instance;
