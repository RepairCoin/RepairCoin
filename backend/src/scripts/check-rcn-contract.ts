import { createThirdwebClient, getContract, readContract } from "thirdweb";
import { defineChain } from "thirdweb/chains";
import * as dotenv from 'dotenv';

dotenv.config();

async function checkRCNContract() {
  const contractAddress = process.env.RCN_CONTRACT_ADDRESS || "0xBFE793d78B6B83859b528F191bd6F2b8555D951C";
  
  console.log(`\n📋 Checking RCN Contract: ${contractAddress}\n`);
  
  const client = createThirdwebClient({
    clientId: process.env.RCN_THIRDWEB_CLIENT_ID || process.env.THIRDWEB_CLIENT_ID || "",
  });

  const chain = defineChain(84532); // Base Sepolia
  
  const contract = getContract({
    client,
    chain,
    address: contractAddress as `0x${string}`,
  });
  
  try {
    // Check basic ERC20 properties
    const name = await readContract({
      contract,
      method: "function name() view returns (string)",
      params: []
    });
    
    const symbol = await readContract({
      contract,
      method: "function symbol() view returns (string)",
      params: []
    });
    
    const decimals = await readContract({
      contract,
      method: "function decimals() view returns (uint8)",
      params: []
    });
    
    const totalSupply = await readContract({
      contract,
      method: "function totalSupply() view returns (uint256)",
      params: []
    });
    
    console.log(`Token Name: ${name}`);
    console.log(`Token Symbol: ${symbol}`);
    console.log(`Decimals: ${decimals}`);
    console.log(`Total Supply: ${Number(totalSupply) / 10**18} ${symbol}`);
    
    // Check if it has owner
    try {
      const owner = await readContract({
        contract,
        method: "function owner() view returns (address)",
        params: []
      });
      console.log(`\nContract Owner: ${owner}`);
    } catch (e) {
      console.log(`\nNo owner() function found - might use AccessControl`);
    }
    
    // Check some common addresses balances
    const adminWallet = process.env.ADMIN_ADDRESSES?.split(',')[0] || "";
    const shopWallet = "0x2dE1BdF96Bb5d861dEf85D5B8F2997792cB21Ece";
    
    console.log(`\n💰 Checking Balances:`);
    
    const adminBalance = await readContract({
      contract,
      method: "function balanceOf(address) view returns (uint256)",
      params: [adminWallet as `0x${string}`]
    });
    console.log(`Admin (${adminWallet}): ${Number(adminBalance) / 10**18} ${symbol}`);
    
    const shopBalance = await readContract({
      contract,
      method: "function balanceOf(address) view returns (uint256)",
      params: [shopWallet as `0x${string}`]
    });
    console.log(`Shop (${shopWallet}): ${Number(shopBalance) / 10**18} ${symbol}`);
    
    // Check if contract has specific functions
    console.log(`\n🔍 Checking Contract Functions:`);
    
    // Try to check for common mint functions
    try {
      // Check for mintTo function by trying to call with 0 amount
      await readContract({
        contract,
        method: "function mintTo(address to, uint256 amount)",
        params: [adminWallet as `0x${string}`, 0n]
      });
      console.log(`✅ Has mintTo() function`);
    } catch (e: any) {
      if (e.message?.includes('function selector was not recognized')) {
        console.log(`❌ No mintTo() function`);
      } else {
        console.log(`⚠️  mintTo() exists but call failed: ${e.message}`);
      }
    }
    
  } catch (error) {
    console.error(`Error checking contract:`, error);
  }
}

checkRCNContract().catch(console.error);