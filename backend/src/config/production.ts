export default {
  port: process.env.PORT || 3000,
  database: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '25060'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: {
      rejectUnauthorized: true,
      ca: process.env.DB_CA_CERT
    }
  },
  cors: {
    origin: process.env.FRONTEND_URL || 'https://repaircoin.vercel.app',
    credentials: true
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: '24h'
  },
  blockchain: {
    network: 'base-sepolia',
    contractAddress: process.env.RCN_CONTRACT_ADDRESS,
    thirdwebClientId: process.env.RCN_THIRDWEB_CLIENT_ID,
    thirdwebSecretKey: process.env.RCN_THIRDWEB_SECRET_KEY,
    privateKey: process.env.PRIVATE_KEY
  },
  swagger: {
    enabled: process.env.ENABLE_SWAGGER === 'true'
  }
};