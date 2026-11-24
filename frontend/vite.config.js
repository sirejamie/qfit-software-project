import { defineConfig } from "vite";

export default defineConfig({
  server: {
    proxy: {
      // Any request starting with /api will be forwarded to your backend
      "/api": {
        target: "http://localhost:8000", // Your backend server URL
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
