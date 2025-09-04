export class Config {
  static get database() {
    return {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'repaircoin',
      user: process.env.DB_USER || 'repaircoin',
      password: process.env.DB_PASSWORD || 'repaircoin123',
      ssl: process.env.NODE_ENV === 'production'
    };
  }

  static get jwt() {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    return {
      secret,
      expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    };
  }

  static get server() {
    return {
      port: parseInt(process.env.PORT || '3000'),
      nodeEnv: process.env.NODE_ENV || 'development',
      corsOrigin: process.env.FRONTEND_URL || 'http://localhost:3001'
    };
  }

  static get admin() {
    const addresses = process.env.ADMIN_ADDRESSES;
    if (!addresses) {
      console.warn('No ADMIN_ADDRESSES configured');
      return [];
    }
    return addresses.split(',').map(addr => addr.trim().toLowerCase());
  }

  static validate(): void {
    // Validate required environment variables
    const required = ['JWT_SECRET'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  }
}