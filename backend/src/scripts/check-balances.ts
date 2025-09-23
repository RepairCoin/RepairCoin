import { createThirdwebClient, getContract, readContract } from "thirdweb";
import { defineChain } from "thirdweb/chains";
import { balanceOf } from "thirdweb/extensions/erc20";
import * as dotenv from 'dotenv';

dotenv.config();

async function checkBalances() {
  const shopWallet = "0x2dE1BdF96Bb5d861dEf85D5B8F2997792cB21Ece";
  
  // Old contract addresses (you might have tokens here)
  const oldContracts = [
    "0xd92ced7c3f4D8E42C05A4c558F37dA6DC731d5f5", // From CLAUDE.md
    // Add any other old contract addresses you know of
  ];
  
  // New contract
  const newContract = process.env.RCN_CONTRACT_ADDRESS || "0xBFE793d78B6B83859b528F191bd6F2b8555D951C";
  
  const client = createThirdwebClient({
    clientId: process.env.RCN_THIRDWEB_CLIENT_ID || process.env.THIRDWEB_CLIENT_ID || "",
  });

  const chain = defineChain(84532); // Base Sepolia
  
  console.log(`Checking RCN balances for shop wallet: ${shopWallet}\n`);
  
  // Check new contract
  try {
    const contract = getContract({
      client,
      chain,
      address: newContract as `0x${string}`,
    });
    
    const balance = await balanceOf({
      contract,
      address: shopWallet as `0x${string}`,
    });
    
    console.log(`Current Contract (${newContract}): ${balance.toString()} RCN`);
  } catch (error) {
    console.error(`Error checking new contract: ${error}`);
  }
  
  // Check old contracts
  for (const oldAddress of oldContracts) {
    try {
      const contract = getContract({
        client,
        chain,
        address: oldAddress as `0x${string}`,
      });
      
      const balance = await balanceOf({
        contract,
        address: shopWallet as `0x${string}`,
      });
      
      console.log(`Old Contract (${oldAddress}): ${balance.toString()} RCN`);
    } catch (error) {
      console.error(`Error checking old contract ${oldAddress}: ${error}`);
    }
  }
  
  // Also check admin wallet
  const adminWallet = process.env.ADMIN_ADDRESSES?.split(',')[0] || "";
  if (adminWallet) {
    console.log(`\nChecking admin wallet: ${adminWallet}`);
    try {
      const contract = getContract({
        client,
        chain,
        address: newContract as `0x${string}`,
      });
      
      const balance = await balanceOf({
        contract,
        address: adminWallet as `0x${string}`,
      });
      
      console.log(`Admin balance on current contract: ${balance.toString()} RCN`);
    } catch (error) {
      console.error(`Error checking admin balance: ${error}`);
    }
  }
}

checkBalances().catch(console.error);