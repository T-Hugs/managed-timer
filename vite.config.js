import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import viteTsConfigPaths from "vite-tsconfig-paths";
import path from "path";

export default defineConfig({
	root: path.join(__dirname, "./src/demo"),
	base: "/super-timer/demo/",
	mode: "production",
	build: {
		outDir: path.join(__dirname, "./docs/demo"),
	},
	plugins: [
		react(),
		viteTsConfigPaths({
			root: __dirname,
		}),
	],
});
