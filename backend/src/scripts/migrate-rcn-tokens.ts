import { createThirdwebClient, getContract, readContract, prepareContractCall, sendTransaction } from "thirdweb";
import { defineChain } from "thirdweb/chains";
import { balanceOf } from "thirdweb/extensions/erc20";
import { privateKeyToAccount } from "thirdweb/wallets";
import * as dotenv from 'dotenv';

dotenv.config();

async function migrateTokens() {
  const shopWallet = "0x2dE1BdF96Bb5d861dEf85D5B8F2997792cB21Ece";
  
  // Old contract that has the tokens
  const oldContract = "0xd92ced7c3f4D8E42C05A4c558F37dA6DC731d5f5";
  
  // New contract where we want to mint tokens
  const newContract = process.env.RCN_CONTRACT_ADDRESS || "0xBFE793d78B6B83859b528F191bd6F2b8555D951C";
  
  const client = createThirdwebClient({
    clientId: process.env.RCN_THIRDWEB_CLIENT_ID || process.env.THIRDWEB_CLIENT_ID || "",
    secretKey: process.env.RCN_THIRDWEB_SECRET_KEY || process.env.THIRDWEB_SECRET_KEY || "",
  });

  const chain = defineChain(84532); // Base Sepolia
  
  // Create wallet account from private key
  const account = privateKeyToAccount({
    client,
    privateKey: process.env.PRIVATE_KEY as `0x${string}`,
  });
  
  console.log(`Migrating RCN tokens for shop wallet: ${shopWallet}\n`);
  console.log(`Admin wallet: ${account.address}\n`);
  
  // Check old contract balance
  try {
    const oldContractInstance = getContract({
      client,
      chain,
      address: oldContract as `0x${string}`,
    });
    
    const oldBalance = await balanceOf({
      contract: oldContractInstance,
      address: shopWallet as `0x${string}`,
    });
    
    const oldBalanceNumber = Number(oldBalance) / 10**18;
    console.log(`Old Contract Balance: ${oldBalanceNumber} RCN`);
    
    if (oldBalanceNumber === 0) {
      console.log("\n⚠️  No tokens to migrate from old contract.");
      return;
    }
    
    // Check new contract balance before minting
    const newContractInstance = getContract({
      client,
      chain,
      address: newContract as `0x${string}`,
    });
    
    const newBalanceBefore = await balanceOf({
      contract: newContractInstance,
      address: shopWallet as `0x${string}`,
    });
    
    console.log(`Current New Contract Balance: ${Number(newBalanceBefore) / 10**18} RCN`);
    
    // Mint equivalent tokens on new contract
    console.log(`\n🪙 Minting ${oldBalanceNumber} RCN on new contract...`);
    
    const mintAmount = BigInt(Math.floor(oldBalanceNumber * 10**18));
    
    const mintTx = prepareContractCall({
      contract: newContractInstance,
      method: "function mintTo(address to, uint256 amount) public",
      params: [shopWallet as `0x${string}`, mintAmount]
    });
    
    const result = await sendTransaction({
      transaction: mintTx,
      account,
    });
    
    console.log(`✅ Successfully minted ${oldBalanceNumber} RCN to shop on new contract!`);
    console.log(`Transaction hash: ${result.transactionHash}`);
    
    // Check new balance after minting
    const newBalanceAfter = await balanceOf({
      contract: newContractInstance,
      address: shopWallet as `0x${string}`,
    });
    
    console.log(`\nFinal New Contract Balance: ${Number(newBalanceAfter) / 10**18} RCN`);
    
  } catch (error) {
    console.error(`Error during migration: ${error}`);
  }
}

migrateTokens().catch(console.error);