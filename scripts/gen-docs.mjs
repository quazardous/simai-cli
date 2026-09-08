import { writeFileSync } from "node:fs";
import { clientsDoc } from "../dist/clients-doc.js";
writeFileSync(new URL("../CLIENTS.md", import.meta.url), clientsDoc());
console.error("CLIENTS.md rewritten from src/dialects.ts");
