import { createThirdwebClient, getContract, readContract } from "thirdweb";
import { defineChain } from "thirdweb/chains";
import { getBlockchainService } from '../domains/shop/services/BlockchainService';
import * as dotenv from 'dotenv';

dotenv.config();

async function checkBlockchainStatus() {
  const contractAddress = process.env.RCN_CONTRACT_ADDRESS || "0xBFE793d78B6B83859b528F191bd6F2b8555D951C";
  const adminWallet = process.env.ADMIN_ADDRESSES?.split(',')[0] || "";
  
  console.log(`\n🔍 Checking Blockchain Integration Status\n`);
  console.log(`Contract: ${contractAddress}`);
  console.log(`Admin Wallet: ${adminWallet}`);
  
  // Check blockchain service status
  const blockchainService = getBlockchainService();
  const status = blockchainService.getBlockchainStatus();
  
  console.log(`\n📊 Blockchain Service Status:`);
  console.log(`- Enabled: ${status.enabled ? '✅ Yes' : '❌ No'}`);
  console.log(`- Contract: ${status.contractAddress}`);
  console.log(`- Network: ${status.network}`);
  
  if (!status.enabled) {
    console.log(`\n⚠️  Blockchain minting is currently DISABLED`);
    console.log(`All RCN operations will be tracked in the database only.`);
    console.log(`\nTo enable blockchain minting:`);
    console.log(`1. Set ENABLE_BLOCKCHAIN_MINTING=true in your .env file`);
    console.log(`2. Ensure admin wallet has MINTER_ROLE on the contract`);
    console.log(`3. Restart the backend server`);
  } else {
    console.log(`\n✅ Blockchain minting is ENABLED`);
    console.log(`RCN purchases will attempt to mint on-chain.`);
  }
  
  // Check Thirdweb configuration
  console.log(`\n🔑 Thirdweb Configuration:`);
  console.log(`- RCN Client ID: ${process.env.RCN_THIRDWEB_CLIENT_ID ? '✅ Set' : '❌ Not set'}`);
  console.log(`- RCN Secret Key: ${process.env.RCN_THIRDWEB_SECRET_KEY ? '✅ Set' : '❌ Not set'}`);
  console.log(`- Private Key: ${process.env.PRIVATE_KEY ? '✅ Set' : '❌ Not set'}`);
  
  // Test contract access
  try {
    const client = createThirdwebClient({
      clientId: process.env.RCN_THIRDWEB_CLIENT_ID || process.env.THIRDWEB_CLIENT_ID || "",
    });

    const chain = defineChain(84532); // Base Sepolia
    
    const contract = getContract({
      client,
      chain,
      address: contractAddress as `0x${string}`,
    });
    
    // Check MINTER_ROLE
    try {
      const MINTER_ROLE = await readContract({
        contract,
        method: "function MINTER_ROLE() view returns (bytes32)",
        params: []
      });
      
      const hasRole = await readContract({
        contract,
        method: "function hasRole(bytes32 role, address account) view returns (bool)",
        params: [MINTER_ROLE, adminWallet as `0x${string}`]
      });
      
      console.log(`\n🔐 Contract Permissions:`);
      console.log(`- Admin has MINTER_ROLE: ${hasRole ? '✅ Yes' : '❌ No'}`);
      
      if (!hasRole) {
        console.log(`\n⚠️  Admin wallet does NOT have MINTER_ROLE`);
        console.log(`This means blockchain minting will fail.`);
        console.log(`\nTo fix this, the contract owner must grant MINTER_ROLE to: ${adminWallet}`);
        console.log(`Contact the person who deployed the contract to grant this role.`);
      }
    } catch (e) {
      console.log(`\n⚠️  Could not check MINTER_ROLE - contract might not use AccessControl`);
    }
    
  } catch (error) {
    console.error(`\n❌ Error checking contract:`, error);
  }
  
  console.log(`\n📝 Summary:`);
  console.log(`- Database tracking: ✅ Always enabled`);
  console.log(`- Blockchain minting: ${status.enabled ? '🟡 Enabled but requires MINTER_ROLE' : '❌ Disabled'}`);
  console.log(`- Hybrid mode: ✅ Active (DB primary, blockchain when available)`);
  console.log(`\nThe system will continue to work with database-only tracking.`);
  console.log(`Blockchain integration can be enabled later without data loss.\n`);
}

checkBlockchainStatus().catch(console.error);