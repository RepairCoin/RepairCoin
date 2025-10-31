// Transfer contract ownership to Gnosis Safe
// Run with: node transfer-to-safe.js

const { ethers } = require('ethers');
require('dotenv').config();

const SAFE_ADDRESS = '0x35b4bA3c4B9A8D1E495cF49264Ce72514B7070B8';
const RCN_CONTRACT = '0xBFE793d78B6B83859b528F191bd6F2b8555D951C';
const RCG_CONTRACT = '0xdaFCC0552d976339cA28EF2e84ca1c6561379c9D';

// ERC20 Contract ABI (simplified - just what we need)
const ABI = [
  'function transferOwnership(address newOwner) public',
  'function grantRole(bytes32 role, address account) public',
  'function DEFAULT_ADMIN_ROLE() public view returns (bytes32)',
  'function owner() public view returns (address)',
  'function hasRole(bytes32 role, address account) public view returns (bool)'
];

async function transferOwnership() {
  // Connect to Base Sepolia
  const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');

  // Use your private key (the wallet that currently owns the contracts)
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  console.log('🔐 Using wallet:', wallet.address);
  console.log('🏦 Safe address:', SAFE_ADDRESS);
  console.log('');

  // RCN Contract
  console.log('📝 Transferring RCN ownership...');
  const rcnContract = new ethers.Contract(RCN_CONTRACT, ABI, wallet);

  try {
    // Check current owner
    const currentOwner = await rcnContract.owner();
    console.log('   Current owner:', currentOwner);

    if (currentOwner.toLowerCase() === SAFE_ADDRESS.toLowerCase()) {
      console.log('   ✅ RCN already owned by Safe!');
    } else {
      // Transfer ownership
      const tx = await rcnContract.transferOwnership(SAFE_ADDRESS);
      console.log('   Transaction sent:', tx.hash);
      console.log('   Waiting for confirmation...');
      await tx.wait();
      console.log('   ✅ RCN ownership transferred!');
    }
  } catch (error) {
    console.log('   ❌ Error:', error.message);
  }

  console.log('');

  // RCG Contract
  console.log('📝 Transferring RCG ownership...');
  const rcgContract = new ethers.Contract(RCG_CONTRACT, ABI, wallet);

  try {
    // Check current owner
    const currentOwner = await rcgContract.owner();
    console.log('   Current owner:', currentOwner);

    if (currentOwner.toLowerCase() === SAFE_ADDRESS.toLowerCase()) {
      console.log('   ✅ RCG already owned by Safe!');
    } else {
      // Transfer ownership
      const tx = await rcgContract.transferOwnership(SAFE_ADDRESS);
      console.log('   Transaction sent:', tx.hash);
      console.log('   Waiting for confirmation...');
      await tx.wait();
      console.log('   ✅ RCG ownership transferred!');
    }
  } catch (error) {
    console.log('   ❌ Error:', error.message);
  }

  console.log('');
  console.log('🎉 Done! Your contracts are now controlled by the Safe.');
  console.log('');
  console.log('Next steps:');
  console.log('1. Go to https://app.safe.global/');
  console.log('2. Connect and select your Safe:', SAFE_ADDRESS);
  console.log('3. Try creating a test mint transaction');
  console.log('4. Get 2 signatures to execute it');
}

transferOwnership().catch(console.error);
