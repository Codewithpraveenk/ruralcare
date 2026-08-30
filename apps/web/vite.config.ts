import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({ envDir:"../../",plugins: [react(), VitePWA({ registerType: "autoUpdate", manifest: { name: "RuralCare Connect", short_name: "RuralCare", theme_color: "#0b6e69", background_color: "#f6fbf9", display: "standalone", icons: [] } })], server: { port:5173,strictPort:true,proxy: { "/api": "http://localhost:8787" } } });
