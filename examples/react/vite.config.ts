import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Match the GitHub project Pages path in development and production.
export default defineConfig({ base: "/forms/", plugins: [react()] });
