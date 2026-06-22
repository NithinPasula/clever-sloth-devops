// Base URL of the Go API. Override with NEXT_PUBLIC_API_URL at build/runtime.
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";
