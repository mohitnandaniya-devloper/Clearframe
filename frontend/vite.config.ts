import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

function getPackageName(id: string) {
  const partsAfterNodeModules = id.split("node_modules/")
  const normalized = partsAfterNodeModules.at(-1)

  if (!normalized || normalized === id) {
    return null
  }

  const parts = normalized.split("/")
  if (parts[0]?.startsWith("@")) {
    return parts.length > 1 ? `${parts[0]}/${parts[1]}` : parts[0]
  }

  return parts[0] ?? null
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      output: {
        entryFileNames: "assets/entry/[name]-[hash].js",
        chunkFileNames: "assets/chunks/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined
          }

          const packageName = getPackageName(id)

          if (!packageName) {
            return "vendor"
          }

          if (["react", "react-dom", "scheduler"].includes(packageName)) {
            return "react-core"
          }

          if (["react-router", "react-router-dom"].includes(packageName)) {
            return "router"
          }

          if (["@tanstack/query-core", "@tanstack/react-query"].includes(packageName)) {
            return "query"
          }

          if (
            [
              "recharts",
              "recharts-scale",
              "react-is",
              "react-smooth",
              "victory-vendor",
              "eventemitter3",
              "tiny-invariant",
              "lodash",
            ].includes(packageName)
          ) {
            return "charts"
          }

          if (packageName === "three") {
            return "three"
          }

          if (["framer-motion", "motion-dom", "motion-utils", "tslib"].includes(packageName)) {
            return "motion"
          }

          if (packageName === "lucide-react") {
            return "icons"
          }

          return "vendor"
        },
      },
    },
  },
})
