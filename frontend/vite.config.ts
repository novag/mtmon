import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = env.API_PROXY_TARGET || env.VITE_API_PROXY_TARGET;

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    ...(apiTarget
      ? {
          server: {
            proxy: {
              "/api": {
                target: apiTarget,
                rewrite: (p) => p.replace(/^\/api/, ""),
                ws: true,
                changeOrigin: true,
                secure: false,
              },
            },
          },
        }
      : {}),
  };
});
