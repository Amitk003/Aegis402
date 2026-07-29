// Compile AegisSplitter.sol using solc
// Requires solc installed: npm install -g solc
// Usage: npx tsx contracts/compile.ts --abi --bin

import { execSync } from 'child_process';
import { mkdirSync, existsSync } from 'fs';

if (!existsSync('./contracts/out')) {
  mkdirSync('./contracts/out', { recursive: true });
}

try {
  console.log('Compiling AegisSplitter.sol...');
  const result = execSync(
    'npx solc --abi --bin contracts/AegisSplitter.sol -o contracts/out --overwrite',
    { encoding: 'utf-8' }
  );
  console.log(result);
  console.log('Compiled to contracts/out/');
} catch (err) {
  console.error('Compile failed:', (err as Error).message);
  console.log('Install solc: npm install -g solc');
  process.exit(1);
}
