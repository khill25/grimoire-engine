import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 15231,
    proxy: {
      "/api/editor": {
        target: "http://localhost:17413",
        changeOrigin: true,
      },
    },
  },
});
