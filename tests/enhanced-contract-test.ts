// tests/enhanced-contract-test.ts
import { createThirdwebClient, getContract, readContract, prepareContractCall, sendTransaction } from "thirdweb";
import { baseSepolia } from "thirdweb/chains";
import { privateKeyToAccount } from "thirdweb/wallets";
import { config as dotenvConfig } from 'dotenv';

// Load environment variables
dotenvConfig();

interface TestConfig {
  contractAddress: string;
  testWalletAddress: string;
  shopId: string;
  testRepairAmount: number;
  testMintAmount: number;
}

interface ContractPermissions {
  hasAdminRole: boolean;
  hasMinterRole: boolean;
  owner?: string;
  roles: string[];
}

export class EnhancedContractTester {
  private client: any;
  private account: any;
  private contract: any;
  private config: TestConfig;

  constructor() {
    this.config = {
      contractAddress: process.env.REPAIRCOIN_CONTRACT_ADDRESS || "0xd92ced7c3f4D8E42C05A4c558F37dA6DC731d5f5",
      testWalletAddress: "0x761E5E59485ec6feb263320f5d636042bD9EBc8c",
      shopId: "shop_001",
      testRepairAmount: 75,
      testMintAmount: 10
    };

    this.initializeClient();
  }

  private initializeClient(): void {
    try {
      this.client = createThirdwebClient({
        clientId: process.env.THIRDWEB_CLIENT_ID!,
        secretKey: process.env.THIRDWEB_SECRET_KEY!,
      });
      
      this.account = privateKeyToAccount({
        client: this.client,
        privateKey: process.env.PRIVATE_KEY!,
      });
      
      this.contract = getContract({
        client: this.client,
        chain: baseSepolia,
        address: this.config.contractAddress,
      });

      console.log("🔧 [Init] Thirdweb client initialized successfully");
    } catch (error: any) {
      console.error("❌ [Init] Failed to initialize client:", error.message);
      throw error;
    }
  }

  // Check all contract permissions and roles
  async checkContractPermissions(): Promise<ContractPermissions> {
    console.log("👑 [Permissions] Checking contract permissions...");
    
    const permissions: ContractPermissions = {
      hasAdminRole: false,
      hasMinterRole: false,
      roles: []
    };

    try {
      // Check for DEFAULT_ADMIN_ROLE (0x00...)
      const adminRole = "0x0000000000000000000000000000000000000000000000000000000000000000";
      permissions.hasAdminRole = await readContract({
        contract: this.contract,
        method: "function hasRole(bytes32 role, address account) view returns (bool)",
        params: [adminRole, this.config.testWalletAddress]
      });

      // Check for MINTER_ROLE (keccak256("MINTER_ROLE"))
      const minterRole = "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";
      permissions.hasMinterRole = await readContract({
        contract: this.contract,
        method: "function hasRole(bytes32 role, address account) view returns (bool)",
        params: [minterRole, this.config.testWalletAddress]
      });

      console.log(`${permissions.hasAdminRole ? "✅" : "❌"} [Permissions] Admin Role`);
      console.log(`${permissions.hasMinterRole ? "✅" : "❌"} [Permissions] Minter Role`);

      if (!permissions.hasMinterRole) {
        console.log("💡 [Permissions] To grant minter role:");
        console.log(`   1. Go to: https://thirdweb.com/base-sepolia-testnet/${this.config.contractAddress}/permissions`);
        console.log(`   2. Grant MINTER_ROLE to: ${this.config.testWalletAddress}`);
      }

      return permissions;
    } catch (error: any) {
      console.error("❌ [Permissions] Error checking permissions:", error.message);
      
      // Try alternative ownership check
      try {
        const owner = await readContract({
          contract: this.contract,
          method: "function owner() view returns (address)",
          params: []
        });
        permissions.owner = owner;
        console.log("📍 [Permissions] Contract Owner:", owner);
      } catch (ownerError) {
        console.log("ℹ️  [Permissions] Contract uses role-based access (no single owner)");
      }

      return permissions;
    }
  }

  // Test token minting with proper error handling
  async testTokenMinting(): Promise<boolean> {
    console.log("🪙 [Minting] Testing token minting...");
    
    try {
      const permissions = await this.checkContractPermissions();
      
      if (!permissions.hasMinterRole && !permissions.hasAdminRole) {
        console.log("⚠️  [Minting] No minting permissions - skipping mint test");
        console.log("💡 [Minting] Grant permissions first, then run test again");
        return false;
      }

      const mintAmount = BigInt(this.config.testMintAmount * Math.pow(10, 18));
      
      console.log(`📋 [Minting] Preparing to mint ${this.config.testMintAmount} tokens...`);

      const transaction = prepareContractCall({
        contract: this.contract,
        method: "function mintTo(address to, uint256 amount) public",
        params: [this.config.testWalletAddress, mintAmount]
      });

      console.log("🚀 [Minting] Sending transaction...");
      
      const result = await sendTransaction({
        transaction,
        account: this.account,
      });

      console.log("✅ [Minting] Success! Transaction Hash:", result.transactionHash);
      console.log(`🔗 [Minting] View on explorer: https://sepolia-explorer.base.org/tx/${result.transactionHash}`);
      
      // Verify new balance
      await this.checkUpdatedBalance();
      
      return true;
    } catch (error: any) {
      console.error("❌ [Minting] Failed to mint tokens:", error.message);
      
      if (error.message.includes("AccessControl")) {
        console.log("💡 [Minting] Fix: Grant MINTER_ROLE in Thirdweb dashboard");
      } else if (error.message.includes("insufficient funds")) {
        console.log("💡 [Minting] Fix: Get Base Sepolia ETH from faucet");
      }
      
      return false;
    }
  }

  // Check balance after minting
  async checkUpdatedBalance(): Promise<void> {
    console.log("💰 [Balance] Checking updated balance...");
    
    try {
      const balance = await readContract({
        contract: this.contract,
        method: "function balanceOf(address) view returns (uint256)",
        params: [this.config.testWalletAddress]
      });
      
      const balanceReadable = Number(balance) / Math.pow(10, 18);
      console.log(`✅ [Balance] New balance: ${balanceReadable} RCN`);
    } catch (error: any) {
      console.error("❌ [Balance] Failed to check balance:", error.message);
    }
  }

  // Test complete repair flow simulation
  async testRepairFlow(): Promise<void> {
    console.log("🔧 [Repair Flow] Testing complete repair flow...");
    
    const customerData = {
      address: this.config.testWalletAddress,
      lifetimeEarnings: 150,
      tier: "SILVER",
      dailyEarnings: 0,
      monthlyEarnings: 100,
      lastEarnedDate: new Date().toISOString().split('T')[0]
    };

    // Simulate business logic
    const repairAmount = this.config.testRepairAmount;
    let tokensToEarn = 0;
    
    if (repairAmount >= 100) {
      tokensToEarn = 25;
    } else if (repairAmount >= 50) {
      tokensToEarn = 10;
    }

    console.log(`📋 [Repair Flow] Repair: $${repairAmount} → ${tokensToEarn} RCN`);
    
    // Check limits
    const dailyOk = (customerData.dailyEarnings + tokensToEarn) <= 40;
    const monthlyOk = (customerData.monthlyEarnings + tokensToEarn) <= 500;
    
    console.log(`${dailyOk ? "✅" : "❌"} [Repair Flow] Daily limit check`);
    console.log(`${monthlyOk ? "✅" : "❌"} [Repair Flow] Monthly limit check`);
    
    if (dailyOk && monthlyOk) {
      console.log("🎯 [Repair Flow] Ready to mint tokens!");
      // Could trigger actual minting here if permissions are set
    }
  }

  // Test contract basic information
  async testContractInfo(): Promise<void> {
    console.log("📋 [Contract Info] Reading contract information...");
    
    try {
      const [name, symbol, totalSupply, decimals] = await Promise.all([
        readContract({
          contract: this.contract,
          method: "function name() view returns (string)",
          params: []
        }),
        readContract({
          contract: this.contract,
          method: "function symbol() view returns (string)", 
          params: []
        }),
        readContract({
          contract: this.contract,
          method: "function totalSupply() view returns (uint256)",
          params: []
        }),
        readContract({
          contract: this.contract,
          method: "function decimals() view returns (uint8)",
          params: []
        })
      ]);
      
      console.log(`✅ [Contract Info] Name: ${name}`);
      console.log(`✅ [Contract Info] Symbol: ${symbol}`);
      console.log(`✅ [Contract Info] Decimals: ${decimals}`);
      console.log(`✅ [Contract Info] Total Supply: ${totalSupply.toString()} wei`);
      console.log(`✅ [Contract Info] Total Supply (readable): ${Number(totalSupply) / Math.pow(10, Number(decimals))} ${symbol}`);
      
    } catch (error: any) {
      console.error("❌ [Contract Info] Failed to read contract info:", error.message);
    }
  }

  // Run comprehensive test suite
  async runComprehensiveTests(): Promise<void> {
    console.log("🎯 Starting Enhanced RepairCoin Test Suite");
    console.log("=".repeat(60));
    
    // Check environment
    const envOk = this.checkEnvironment();
    if (!envOk) return;
    
    // Test contract connection and info
    await this.testContractInfo();
    
    // Check permissions (this is the key step)
    const permissions = await this.checkContractPermissions();
    
    // Test repair flow logic
    await this.testRepairFlow();
    
    // Test minting (only if permissions are granted)
    console.log("\n🪙 [Minting Test] Attempting to mint tokens...");
    const mintSuccess = await this.testTokenMinting();
    
    console.log("\n" + "=".repeat(60));
    console.log("📊 ENHANCED TEST SUMMARY");
    console.log("=".repeat(60));
    
    if (mintSuccess) {
      console.log("🎉 All systems operational! Ready for backend development!");
      console.log("🚀 Next steps:");
      console.log("   1. Set up Firebase project");
      console.log("   2. Deploy backend server");
      console.log("   3. Test FixFlow webhook integration");
    } else {
      console.log("⚠️  Grant minting permissions to continue");
      console.log("🔗 Dashboard: https://thirdweb.com/dashboard");
      console.log("📖 Instructions: Follow the non-technical guide provided");
    }
  }

  private checkEnvironment(): boolean {
    console.log("🔍 [Environment] Checking environment configuration...");
    
    const required = [
      'THIRDWEB_CLIENT_ID',
      'THIRDWEB_SECRET_KEY', 
      'PRIVATE_KEY',
      'REPAIRCOIN_CONTRACT_ADDRESS'
    ];
    
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      console.error("❌ Missing environment variables:", missing.join(', '));
      console.log("💡 Create a .env file with the required variables");
      return false;
    }
    
    console.log("✅ Environment configured correctly");
    console.log(`📍 Contract Address: ${this.config.contractAddress}`);
    console.log(`📍 Test Wallet: ${this.config.testWalletAddress}`);
    return true;
  }
}

// Main execution function
async function main(): Promise<void> {
  try {
    const tester = new EnhancedContractTester();
    await tester.runComprehensiveTests();
  } catch (error: any) {
    console.error("💥 Test execution failed:", error.message);
    process.exit(1);
  }
}

// Export for use as module
export { EnhancedContractTester };

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error("💥 Fatal error:", error);
    process.exit(1);
  });
}