import { ethers, run } from "hardhat";
import * as fs from "fs";
import * as path from "path";

type Deployment = {
  network: string;
  token: { address: string; constructorArgs: any[] };
  vesting: { address: string; constructorArgs: any[] };
};

async function verifyOne(address: string, constructorArguments: any[]) {
  console.log(`\nVerifying ${address} ...`);
  try {
    await run("verify:verify", {
      address,
      constructorArguments,
    });
    console.log(`✅ Verified: ${address}`);
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (msg.includes("Already Verified")) {
      console.log(`ℹ️ Already verified: ${address}`);
    } else {
      console.error(`❌ Verify failed for ${address}\n`, msg);
    }
  }
}

async function main() {
  // Choose file by network (baseSepolia or base)
  const net = (await ethers.provider.getNetwork()).name || "baseSepolia";
  const file =
    net.toLowerCase().includes("sepolia")
      ? "base-sepolia.json"
      : "base.json";

  const p = path.join(__dirname, "..", "deployments", file);
  if (!fs.existsSync(p)) {
    throw new Error(`Deployments file not found: ${p}`);
  }

  const data: Deployment = JSON.parse(fs.readFileSync(p, "utf8"));

  // Sanity check
  console.log(`Network: ${net}`);
  console.log(`Using deployments from: ${p}`);

  // Verify token
  await verifyOne(data.token.address, data.token.constructorArgs);

  // Verify vesting
  await verifyOne(data.vesting.address, data.vesting.constructorArgs);

  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});