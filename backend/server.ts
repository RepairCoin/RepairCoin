// backend/server.ts
import RepairCoinApp from './src/app';

// Initialize and start the server
async function main() {
  try {
    const app = new RepairCoinApp();
    await app.initialize();
    app.start();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();