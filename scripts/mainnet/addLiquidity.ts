import { ethers } from "hardhat";

/**
 * Script to add TENDER liquidity to multiple pools on Base mainnet
 * 
 * Usage:
 * npx hardhat run scripts/mainnet/addLiquidity.ts --network base
 */

// Base mainnet token addresses
const TENDER_ADDRESS = "0xD199870e61018163f1214d1790A5d49c556b812F";
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // USDC on Base
const USDT_ADDRESS = "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb"; // USDT on Base

// Uniswap V3 contracts on Base mainnet
const NONFUNGIBLE_POSITION_MANAGER = "0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1"; // Base mainnet NonfungiblePositionManager

// Liquidity configuration
const LIQUIDITY_CONFIG = {
  TENDER_USDC: {
    tenderAmount: "22500000", // 22.5M TENDER
    usdcAmount: "200", // 200 USDC (~$200)
    fee: 3000, // 0.3% fee tier
  },
  TENDER_USDT: {
    tenderAmount: "22500000", // 22.5M TENDER
    usdtAmount: "200", // 200 USDT (~$200)
    fee: 3000, // 0.3% fee tier
  },
};

// Price range (full range for simplicity)
const TICK_LOWER = -887272;
const TICK_UPPER = 887272;

async function getTokenContract(address: string, signer: any) {
  return await ethers.getContractAt(
    [
      "function balanceOf(address) view returns (uint256)",
      "function approve(address spender, uint256 amount) returns (bool)",
      "function allowance(address owner, address spender) view returns (uint256)",
      "function decimals() view returns (uint8)",
      "function symbol() view returns (string)"
    ],
    address,
    signer
  );
}

async function checkAndApprove(tokenContract: any, owner: string, spender: string, amount: bigint, tokenName: string) {
  const allowance = await tokenContract.allowance(owner, spender);
  
  if (allowance < amount) {
    console.log(`Approving ${tokenName}...`);
    
    // Get current gas price and add 20% buffer
    const feeData = await ethers.provider.getFeeData();
    const gasPrice = feeData.gasPrice || BigInt(1000000000); // fallback to 1 gwei
    const bufferedGasPrice = gasPrice * 120n / 100n; // 20% higher
    
    const approveTx = await tokenContract.approve(spender, amount, {
      gasPrice: bufferedGasPrice
    });
    await approveTx.wait();
    console.log(`✅ ${tokenName} approved: ${approveTx.hash}`);
  } else {
    console.log(`✅ ${tokenName} already approved`);
  }
}

async function addLiquidityToPool(
  tokenA: string,
  tokenB: string,
  amountA: bigint,
  amountB: bigint,
  fee: number,
  signer: any
) {
  const positionManager = await ethers.getContractAt(
    [
      "function mint((address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline)) external returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)"
    ],
    NONFUNGIBLE_POSITION_MANAGER,
    signer
  );

  // Determine token order (token0 < token1)
  const token0 = tokenA < tokenB ? tokenA : tokenB;
  const token1 = tokenA < tokenB ? tokenB : tokenA;
  
  const amount0Desired = token0 === tokenA ? amountA : amountB;
  const amount1Desired = token1 === tokenB ? amountB : amountA;

  // Set minimum amounts (allow 5% slippage)
  const amount0Min = (amount0Desired * 95n) / 100n;
  const amount1Min = (amount1Desired * 95n) / 100n;

  const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes
  const owner = await signer.getAddress();

  const mintParams = {
    token0,
    token1,
    fee,
    tickLower: TICK_LOWER,
    tickUpper: TICK_UPPER,
    amount0Desired,
    amount1Desired,
    amount0Min,
    amount1Min,
    recipient: owner,
    deadline
  };

  console.log("Adding liquidity with params:", {
    token0,
    token1,
    fee,
    amount0Desired: ethers.formatUnits(amount0Desired, 18),
    amount1Desired: ethers.formatUnits(amount1Desired, 18),
  });

  // Get current gas price and add 20% buffer
  const feeData = await ethers.provider.getFeeData();
  const gasPrice = feeData.gasPrice || BigInt(1000000000); // fallback to 1 gwei
  const bufferedGasPrice = gasPrice * 120n / 100n; // 20% higher
  
  const mintTx = await positionManager.mint(mintParams, {
    gasPrice: bufferedGasPrice
  });
  const receipt = await mintTx.wait();
  
  console.log(`✅ Liquidity added successfully!`);
  console.log(`Transaction hash: ${receipt?.hash}`);
  
  return receipt;
}

async function main() {
  const [signer] = await ethers.getSigners();
  const owner = await signer.getAddress();
  
  console.log(`Owner: ${owner}`);
  console.log(`ETH Balance: ${ethers.formatEther(await ethers.provider.getBalance(owner))} ETH`);

  // Get token contracts
  const tenderContract = await getTokenContract(TENDER_ADDRESS, signer);
  const usdcContract = await getTokenContract(USDC_ADDRESS, signer);
  const usdtContract = await getTokenContract(USDT_ADDRESS, signer);

  // Check balances
  const tenderBalance = await tenderContract.balanceOf(owner);
  const usdcBalance = await usdcContract.balanceOf(owner);
  const usdtBalance = await usdtContract.balanceOf(owner);

  console.log(`\n📊 Current Balances:`);
  console.log(`TENDER: ${ethers.formatUnits(tenderBalance, 18)}`);
  console.log(`USDC: ${ethers.formatUnits(usdcBalance, 6)}`);
  console.log(`USDT: ${ethers.formatUnits(usdtBalance, 6)}`);

  // Check if we have enough tokens
  const totalTenderNeeded = ethers.parseUnits("45000000", 18); // 45M total
  if (tenderBalance < totalTenderNeeded) {
    throw new Error(`Insufficient TENDER balance. Need 45M, have ${ethers.formatUnits(tenderBalance, 18)}`);
  }

  console.log(`\n🚀 Adding Liquidity to Multiple Pools...`);

  // 1. TENDER/USDC Pool
  console.log(`\n1️⃣ Creating TENDER/USDC Pool...`);
  const tenderUsdcAmount = ethers.parseUnits(LIQUIDITY_CONFIG.TENDER_USDC.tenderAmount, 18);
  const usdcAmount = ethers.parseUnits(LIQUIDITY_CONFIG.TENDER_USDC.usdcAmount, 6);

  if (usdcBalance < usdcAmount) {
    throw new Error(`Insufficient USDC balance. Need ${LIQUIDITY_CONFIG.TENDER_USDC.usdcAmount}, have ${ethers.formatUnits(usdcBalance, 6)}`);
  }

  await checkAndApprove(tenderContract, owner, NONFUNGIBLE_POSITION_MANAGER, tenderUsdcAmount, "TENDER");
  await checkAndApprove(usdcContract, owner, NONFUNGIBLE_POSITION_MANAGER, usdcAmount, "USDC");
  
  await addLiquidityToPool(
    TENDER_ADDRESS,
    USDC_ADDRESS,
    tenderUsdcAmount,
    usdcAmount,
    LIQUIDITY_CONFIG.TENDER_USDC.fee,
    signer
  );

  // 2. TENDER/USDT Pool
  console.log(`\n2️⃣ Creating TENDER/USDT Pool...`);
  const tenderUsdtAmount = ethers.parseUnits(LIQUIDITY_CONFIG.TENDER_USDT.tenderAmount, 18);
  const usdtAmount = ethers.parseUnits(LIQUIDITY_CONFIG.TENDER_USDT.usdtAmount, 6);

  if (usdtBalance < usdtAmount) {
    throw new Error(`Insufficient USDT balance. Need ${LIQUIDITY_CONFIG.TENDER_USDT.usdtAmount}, have ${ethers.formatUnits(usdtBalance, 6)}`);
  }

  await checkAndApprove(tenderContract, owner, NONFUNGIBLE_POSITION_MANAGER, tenderUsdtAmount, "TENDER");
  await checkAndApprove(usdtContract, owner, NONFUNGIBLE_POSITION_MANAGER, usdtAmount, "USDT");
  
  await addLiquidityToPool(
    TENDER_ADDRESS,
    USDT_ADDRESS,
    tenderUsdtAmount,
    usdtAmount,
    LIQUIDITY_CONFIG.TENDER_USDT.fee,
    signer
  );

  console.log(`\n🎉 All liquidity pools created successfully!`);
  console.log(`\n📋 Summary:`);
  console.log(`- TENDER/USDC: 22.5M TENDER + 200 USDC (~$200)`);
  console.log(`- TENDER/USDT: 22.5M TENDER + 200 USDT (~$200)`);
  console.log(`\n💰 Total Investment: ~$400`);
  console.log(`💰 Remaining TENDER: ${ethers.formatUnits(tenderBalance - totalTenderNeeded, 18)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
