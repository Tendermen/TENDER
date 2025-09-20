import { ethers } from "hardhat";
import { NonceManager } from "ethers";

async function main() {
  const [raw] = await ethers.getSigners();
  console.log("Deployer:", raw.address);
  console.log("Balance:", (await ethers.provider.getBalance(raw.address)).toString());

  // Optional: wrap in NonceManager to avoid nonce races
  const signer = new NonceManager(raw);

  // 1) Deploy TENDER
  const Tender = await ethers.getContractFactory("TENDER", signer);
  const tender = await Tender.deploy(raw.address); // no gasLimit override
  await tender.waitForDeployment();
  console.log("TENDER:", await tender.getAddress());

  // 2) Deploy VestingWallet (1y cliff, 3y linear)
  const beneficiary = process.env.OWNER_BENEFICIARY!;
  if (!/^0x[0-9a-fA-F]{40}$/.test(beneficiary)) throw new Error("Invalid OWNER_BENEFICIARY");

  const now = BigInt(Math.floor(Date.now() / 1000));
  const start = now + 365n * 24n * 60n * 60n;
  const duration = 1095n * 24n * 60n * 60n;
  console.log({ beneficiary, start: start.toString(), duration: duration.toString() });

  const Vest = await ethers.getContractFactory("VestingWallet", signer);
  const vest = await Vest.deploy(beneficiary, start, duration); // let node estimate gas
  await vest.waitForDeployment();
  console.log("VestingWallet:", await vest.getAddress());

  // 3) Transfer 5M TNDR into vesting
  const fiveM = ethers.parseUnits("5000000", 18);
  const tx = await tender.transfer(await vest.getAddress(), fiveM);
  await tx.wait();
  console.log("Moved 5,000,000 TNDR into vesting.");
}

main().catch((e) => { console.error(e); process.exit(1); });