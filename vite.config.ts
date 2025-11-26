import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  base: "/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@components": path.resolve(__dirname, "src/components"),
      "@lib": path.resolve(__dirname, "src/lib"),
      "@hooks": path.resolve(__dirname, "src/hooks"),
      "@styles": path.resolve(__dirname, "src/styles"),
      "@assets": path.resolve(__dirname, "src/assets"),
      "@utils/*": path.resolve(__dirname, "src/utils/*"),
      "@types/*": path.resolve(__dirname, "src/types/*"),
      "@interfaces/*": path.resolve(__dirname, "src/interfaces/*"),
      "@interfaces": path.resolve(__dirname, "src/interfaces/index.ts"),
      "@api/*": path.resolve(__dirname, "src/api/*"),
      "@store/*": path.resolve(__dirname, "src/store/*"),
      "@config/*": path.resolve(__dirname, "src/config/*"),
      "@helpers/*": path.resolve(__dirname, "src/helpers/*"),
      "@data/*": path.resolve(__dirname, "src/data/*"),
    },
  },
  server: {
    port: 8080,
  },
});
