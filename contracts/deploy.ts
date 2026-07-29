// AegisSplitter deployment script
// Usage: npx tsx contracts/deploy.ts
// Requires PRIVATE_KEY env var (deployer wallet)
//
// Networks:
//   eip155:84532 -> Base Sepolia (testnet)
//   eip155:8453  -> Base Mainnet

import { ethers } from 'ethers';
import { readFileSync, existsSync } from 'fs';

const USDC_ADDRESSES: Record<string, string> = {
  'eip155:84532': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  'eip155:8453': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
};

const TREASURY_ADDRESS = process.env.AEGIS_TREASURY || '0xAeGis402TrEaSuRyAdDrEsSeTiNpRoDuCtIoN';

async function main() {
  const network = process.env.NETWORK || 'eip155:84532';
  const privateKey = process.env.PRIVATE_KEY;

  if (!privateKey) {
    console.log('ERROR: PRIVATE_KEY environment variable is required');
    process.exit(1);
  }

  const usdcAddress = USDC_ADDRESSES[network];
  if (!usdcAddress) {
    console.log(`ERROR: Unknown network ${network}. Supported: ${Object.keys(USDC_ADDRESSES).join(', ')}`);
    process.exit(1);
  }

  const rpcMap: Record<string, string> = {
    'eip155:84532': 'https://sepolia.base.org',
    'eip155:8453': 'https://mainnet.base.org',
  };
  const rpcUrl = process.env.RPC_URL || rpcMap[network];
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  // Load compiled artifact
  const artifactPath = './contracts/out/AegisSplitter.json';
  if (!existsSync(artifactPath)) {
    console.log('ERROR: Compiled artifact not found at', artifactPath);
    console.log('Compile first with: npx solc --abi --bin contracts/AegisSplitter.sol -o contracts/out');
    process.exit(1);
  }

  const compiled = JSON.parse(readFileSync(artifactPath, 'utf-8'));

  console.log(`Deploying to ${network}`);
  console.log(`Deployer: ${wallet.address}`);
  console.log(`USDC: ${usdcAddress}`);
  console.log(`Treasury: ${TREASURY_ADDRESS}`);

  const factory = new ethers.ContractFactory(compiled.abi, compiled.bytecode, wallet);
  const contract = await factory.deploy(usdcAddress, TREASURY_ADDRESS);

  console.log(`Deploying... tx: ${contract.deploymentTransaction()?.hash}`);
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  console.log(`Deployed at: ${contractAddress}`);
  console.log(`Treasury: ${await contract.treasury()}`);
  console.log(`Fee: ${await contract.FEE_BPS()} bps (0.5%)`);

  console.log('\nAdd to .env:');
  console.log(`SPLITTER_ADDRESS=${contractAddress}`);
}

main().catch((err) => {
  console.error('Deploy failed:', err);
  process.exit(1);
});
