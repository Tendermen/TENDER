// scripts/approve.ts
import { ethers } from "hardhat";

/**
 * Usage:
 *  TOKEN=0x... SPENDER=0x... AMOUNT=100000 npx hardhat run scripts/approve.ts --network base
 *  (AMOUNT is in whole tokens; script handles decimals = 18 by default)
 */
async function main() {
  const tokenAddr = "0xD199870e61018163f1214d1790A5d49c556b812F"; // TNDR mainnet address
  const spender   = "0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24"; // Base mainnet Uniswap V3 router
  const amountStr = "45000000";  // e.g., "45000000" for 45,000,000m TNDR

  const [signer] = await ethers.getSigners();

  // Minimal ERC20 ABI for decimals/allowance/approve/name/symbol
  const erc20 = await ethers.getContractAt(
    [
      "function name() view returns (string)",
      "function symbol() view returns (string)",
      "function decimals() view returns (uint8)",
      "function allowance(address owner, address spender) view returns (uint256)",
      "function approve(address spender, uint256 amount) returns (bool)"
    ],
    tokenAddr,
    signer
  );

  const [nm, sym, dec] = await Promise.all([erc20.name(), erc20.symbol(), erc20.decimals()]);
  const owner = await signer.getAddress();

  const parse = (v: string) => ethers.parseUnits(v, dec);
  const amount = parse(amountStr);

  const before = await erc20.allowance(owner, spender);
  console.log(`Token: ${nm} (${sym}), decimals: ${dec}`);
  console.log(`Owner: ${owner}`);
  console.log(`Spender: ${spender}`);
  console.log(`Allowance before: ${before.toString()}`);

  console.log(`Approving ${amountStr} ${sym}...`);
  const tx = await erc20.approve(spender, amount);
  const rcpt = await tx.wait();
  console.log(`✅ approve() tx: ${rcpt?.hash}`);

  const after = await erc20.allowance(owner, spender);
  console.log(`Allowance after:  ${after.toString()}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});