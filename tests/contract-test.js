const { createThirdwebClient, getContract, readContract, prepareContractCall, sendTransaction } = require("thirdweb");
const { baseSepolia } = require("thirdweb/chains");
const { privateKeyToAccount } = require("thirdweb/wallets");
require('dotenv').config();

async function testRepairCoinContract() {
  console.log("🎯 RepairCoin Contract Test");
  console.log("===========================");
  
  // Configuration
  const CONFIG = {
    contractAddress: process.env.REPAIRCOIN_CONTRACT_ADDRESS || "0xd92ced7c3f4D8E42C05A4c558F37dA6DC731d5f5",
    testWalletAddress: "0x761E5E59485ec6feb263320f5d636042bD9EBc8c",
    testMintAmount: 10
  };

  try {
    // 1. Check environment
    console.log("🔍 Checking environment...");
    const required = ['THIRDWEB_CLIENT_ID', 'THIRDWEB_SECRET_KEY', 'PRIVATE_KEY'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      console.log("❌ Missing environment variables:", missing.join(', '));
      return;
    }
    console.log("✅ Environment variables found");

    // 2. Initialize Thirdweb
    console.log("🔧 Initializing Thirdweb...");
    const client = createThirdwebClient({
      clientId: process.env.THIRDWEB_CLIENT_ID,
      secretKey: process.env.THIRDWEB_SECRET_KEY,
    });
    console.log("✅ Thirdweb client created");

    // 3. Create account
    const account = privateKeyToAccount({
      client: client,
      privateKey: process.env.PRIVATE_KEY,
    });
    console.log("✅ Account loaded:", account.address);

    // 4. Get contract
    const contract = getContract({
      client: client,
      chain: baseSepolia,
      address: CONFIG.contractAddress,
    });
    console.log("✅ Contract connected:", CONFIG.contractAddress);

    // 5. Read contract info
    console.log("📋 Reading contract information...");
    const name = await readContract({
      contract: contract,
      method: "function name() view returns (string)",
      params: []
    });
    
    const symbol = await readContract({
      contract: contract,
      method: "function symbol() view returns (string)",
      params: []
    });
    
    const totalSupply = await readContract({
      contract: contract,
      method: "function totalSupply() view returns (uint256)",
      params: []
    });

    console.log(`✅ Name: ${name}`);
    console.log(`✅ Symbol: ${symbol}`);
    console.log(`✅ Total Supply: ${Number(totalSupply) / Math.pow(10, 18)} ${symbol}`);

    // 6. Check current balance
    console.log("💰 Checking current balance...");
    const balance = await readContract({
      contract: contract,
      method: "function balanceOf(address) view returns (uint256)",
      params: [CONFIG.testWalletAddress]
    });
    const balanceReadable = Number(balance) / Math.pow(10, 18);
    console.log(`✅ Current balance: ${balanceReadable} ${symbol}`);

    // 7. Check minting permissions
    console.log("👑 Checking minting permissions...");
    const minterRole = "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";
    const hasMinterRole = await readContract({
      contract: contract,
      method: "function hasRole(bytes32 role, address account) view returns (bool)",
      params: [minterRole, CONFIG.testWalletAddress]
    });

    console.log(`${hasMinterRole ? "✅" : "❌"} Minter Role: ${hasMinterRole ? "Granted" : "Not granted"}`);

    if (!hasMinterRole) {
      console.log("\n💡 To grant minting permissions:");
      console.log(`   1. Go to: https://thirdweb.com/base-sepolia-testnet/${CONFIG.contractAddress}/permissions`);
      console.log(`   2. Grant MINTER_ROLE to: ${CONFIG.testWalletAddress}`);
      console.log(`   3. Run this test again`);
      console.log("\n⚠️  Skipping mint test - permissions required");
    } else {
      // 8. Test minting
      console.log("🪙 Testing token minting...");
      const mintAmount = BigInt(CONFIG.testMintAmount * Math.pow(10, 18));
      
      const transaction = prepareContractCall({
        contract: contract,
        method: "function mintTo(address to, uint256 amount) public",
        params: [CONFIG.testWalletAddress, mintAmount]
      });

      console.log(`🚀 Minting ${CONFIG.testMintAmount} tokens...`);
      const result = await sendTransaction({
        transaction,
        account: account,
      });

      console.log("✅ Mint successful!");
      console.log("📄 Transaction Hash:", result.transactionHash);
      console.log(`🔗 View on explorer: https://sepolia-explorer.base.org/tx/${result.transactionHash}`);

      // Check new balance
      const newBalance = await readContract({
        contract: contract,
        method: "function balanceOf(address) view returns (uint256)",
        params: [CONFIG.testWalletAddress]
      });
      const newBalanceReadable = Number(newBalance) / Math.pow(10, 18);
      console.log(`�� New balance: ${newBalanceReadable} ${symbol}`);
    }

    console.log("\n🎉 Contract test completed successfully!");
    
    if (hasMinterRole) {
      console.log("✅ All systems operational! Ready for backend development!");
    } else {
      console.log("⚠️  Grant minting permissions to unlock full functionality");
    }

  } catch (error) {
    console.error("❌ Test failed:", error.message);
    
    if (error.message.includes("insufficient funds")) {
      console.log("💡 Get Base Sepolia ETH from: https://faucet.quicknode.com/base/sepolia");
    } else if (error.message.includes("AccessControl")) {
      console.log("💡 Grant MINTER_ROLE in Thirdweb dashboard");
    }
  }
}

// Run the test
testRepairCoinContract();
