import { createThirdwebClient, getContract, readContract, prepareContractCall, sendTransaction } from "thirdweb";
import { defineChain } from "thirdweb/chains";
import { privateKeyToAccount } from "thirdweb/wallets";
import * as dotenv from 'dotenv';

dotenv.config();

async function setupMinterRole() {
  const adminWallet = process.env.ADMIN_ADDRESSES?.split(',')[0] || "";
  const contractAddress = process.env.RCN_CONTRACT_ADDRESS || "0xBFE793d78B6B83859b528F191bd6F2b8555D951C";
  
  console.log(`\n🔧 Setting up MINTER_ROLE for RCN contract`);
  console.log(`Contract: ${contractAddress}`);
  console.log(`Admin wallet: ${adminWallet}\n`);
  
  const client = createThirdwebClient({
    clientId: process.env.RCN_THIRDWEB_CLIENT_ID || process.env.THIRDWEB_CLIENT_ID || "",
    secretKey: process.env.RCN_THIRDWEB_SECRET_KEY || process.env.THIRDWEB_SECRET_KEY || "",
  });

  const chain = defineChain(84532); // Base Sepolia
  
  const account = privateKeyToAccount({
    client,
    privateKey: process.env.PRIVATE_KEY as `0x${string}`,
  });
  
  const contract = getContract({
    client,
    chain,
    address: contractAddress as `0x${string}`,
  });
  
  try {
    // First, check if we already have MINTER_ROLE
    console.log(`Checking current roles...`);
    
    // Get MINTER_ROLE hash
    const MINTER_ROLE = await readContract({
      contract,
      method: "function MINTER_ROLE() view returns (bytes32)",
      params: []
    });
    
    console.log(`MINTER_ROLE hash: ${MINTER_ROLE}`);
    
    // Check if admin already has MINTER_ROLE
    const hasRole = await readContract({
      contract,
      method: "function hasRole(bytes32 role, address account) view returns (bool)",
      params: [MINTER_ROLE, adminWallet as `0x${string}`]
    });
    
    if (hasRole) {
      console.log(`✅ Admin wallet already has MINTER_ROLE!`);
      return;
    }
    
    console.log(`❌ Admin wallet does NOT have MINTER_ROLE`);
    
    // Check who is the admin of the contract
    const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
    const isAdmin = await readContract({
      contract,
      method: "function hasRole(bytes32 role, address account) view returns (bool)",
      params: [DEFAULT_ADMIN_ROLE as `0x${string}`, account.address]
    });
    
    if (!isAdmin) {
      console.log(`❌ Current wallet (${account.address}) is not an admin of the contract`);
      console.log(`Cannot grant MINTER_ROLE without admin privileges`);
      
      // Try to find who is the admin
      console.log(`\nChecking who has DEFAULT_ADMIN_ROLE...`);
      // This is tricky without events, but we can check common addresses
      
      return;
    }
    
    // Grant MINTER_ROLE to admin wallet
    console.log(`\n🔑 Granting MINTER_ROLE to ${adminWallet}...`);
    
    const grantTx = prepareContractCall({
      contract,
      method: "function grantRole(bytes32 role, address account)",
      params: [MINTER_ROLE, adminWallet as `0x${string}`]
    });
    
    const result = await sendTransaction({
      transaction: grantTx,
      account,
    });
    
    console.log(`✅ MINTER_ROLE granted successfully!`);
    console.log(`Transaction hash: ${result.transactionHash}`);
    
    // Verify it worked
    const nowHasRole = await readContract({
      contract,
      method: "function hasRole(bytes32 role, address account) view returns (bool)",
      params: [MINTER_ROLE, adminWallet as `0x${string}`]
    });
    
    if (nowHasRole) {
      console.log(`✅ Verified: Admin wallet now has MINTER_ROLE!`);
    } else {
      console.log(`❌ Warning: Role grant may have failed`);
    }
    
  } catch (error) {
    console.error(`Error setting up MINTER_ROLE:`, error);
  }
}

setupMinterRole().catch(console.error);