import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";

// https://vite.dev/config/
export default defineConfig({
  base: "/", // agar aap server pe /Inspection/ folder me deploy kar rahe ho
  plugins: [
    react(),
    svgr({
      svgrOptions: {
        icon: true,              // SVG ko React icon jaisa treat kare
        exportType: "named",     // named export use hoga
        namedExport: "ReactComponent", // aapke import syntax ke liye
      },
    }),
  ],
});
