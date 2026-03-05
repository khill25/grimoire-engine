import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api/editor": {
        target: "http://localhost:14200",
        changeOrigin: true,
      },
    },
  },
});
