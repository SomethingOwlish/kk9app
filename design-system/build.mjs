import esbuild from "esbuild";
import { copyFileSync, mkdirSync } from "fs";

mkdirSync("dist", { recursive: true });

const shared = {
  entryPoints: ["src/index.jsx"],
  bundle: true,
  external: ["react", "react/jsx-runtime", "react-dom"],
  jsx: "automatic",
};

await esbuild.build({ ...shared, format: "esm", outfile: "dist/index.es.js" });
await esbuild.build({ ...shared, format: "cjs", outfile: "dist/index.cjs.js" });
copyFileSync("src/styles.css", "dist/styles.css");
console.log("Build complete.");
