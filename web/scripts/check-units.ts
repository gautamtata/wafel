import { UNIT_LEVELS } from "../src/lib/unit-schema";
import { loadContentFile } from "../src/lib/unit-content";

let failed = false;
let total = 0;
for (const level of UNIT_LEVELS) {
  try {
    const file = loadContentFile(level);
    if (!file) {
      console.log(`${level}: (missing)`);
      continue;
    }
    total += file.units.length;
    console.log(`${level}: ${file.units.length} units ok`);
  } catch (error) {
    failed = true;
    console.error(`${level}: INVALID\n${error instanceof Error ? error.message : String(error)}`);
  }
}
console.log(`total: ${total} units`);
process.exit(failed ? 1 : 0);
