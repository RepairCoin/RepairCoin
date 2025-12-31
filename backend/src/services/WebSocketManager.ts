import { WebSocket, Server as WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { logger } from '../utils/logger';
import jwt from 'jsonwebtoken';
import { Notification } from '../repositories/NotificationRepository';

type WebSocketClient = WebSocket & {
  walletAddress?: string;
  isAlive?: boolean;
  authTimeout?: NodeJS.Timeout;
}

interface AuthenticatedMessage {
  token: string;
}

interface WebSocketMessage {
  type: string;
  payload?: any;
}

export class WebSocketManager {
  private wss: WebSocketServer;
  private clients: Map<string, Set<WebSocketClient>>;
  private heartbeatInterval: NodeJS.Timeout | null;
  private connectionAttempts: Map<string, { count: number; resetAt: number }>;
  private readonly MAX_ATTEMPTS_PER_MINUTE = 10;
  private readonly ATTEMPT_WINDOW_MS = 60000; // 1 minute

  constructor(wss: WebSocketServer) {
    this.wss = wss;
    this.clients = new Map();
    this.heartbeatInterval = null;
    this.connectionAttempts = new Map();
    this.initialize();
    this.startAttemptCleanup();
  }

  private initialize(): void {
    this.wss.on('connection', (ws: WebSocketClient, request: IncomingMessage) => {
      this.handleConnection(ws, request);
    });

    // Start heartbeat to detect broken connections
    this.startHeartbeat();

    logger.info('WebSocket manager initialized');
  }

  private handleConnection(ws: WebSocketClient, request: IncomingMessage): void {
    ws.isAlive = true;

    // Get client IP for rate limiting
    const clientIP = this.getClientIP(request);

    // Check rate limit
    if (!this.checkRateLimit(clientIP)) {
      logger.warn('WebSocket connection rate limit exceeded', {
        ip: clientIP,
        maxAttempts: this.MAX_ATTEMPTS_PER_MINUTE
      });
      this.sendError(ws, 'Too many connection attempts. Please try again later.');
      ws.close();
      return;
    }

    logger.debug('New WebSocket connection established', { ip: clientIP });

    // Set a timeout for authentication - if not authenticated within 5 seconds, close connection
    ws.authTimeout = setTimeout(() => {
      if (!ws.walletAddress) {
        logger.debug('WebSocket authentication timeout - closing unauthenticated connection');
        this.sendError(ws, 'Authentication required');
        ws.close();
      }
    }, 5000);

    // Try to authenticate from cookie on connection
    this.tryAuthenticateFromCookie(ws, request);

    // Ping/pong for connection health
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (data: Buffer) => {
      try {
        const message: WebSocketMessage = JSON.parse(data.toString());
        this.handleMessage(ws, message);
      } catch (error) {
        logger.error('Error parsing WebSocket message:', error);
        this.sendError(ws, 'Invalid message format');
      }
    });

    ws.on('close', () => {
      // Clear auth timeout if exists
      if (ws.authTimeout) {
        clearTimeout(ws.authTimeout);
      }
      this.handleDisconnection(ws);
    });

    ws.on('error', (error) => {
      logger.error('WebSocket error:', error);
    });

    // Send welcome message
    this.send(ws, {
      type: 'connected',
      payload: { message: 'Connected to notification server' }
    });
  }

  private async handleMessage(ws: WebSocketClient, message: WebSocketMessage): Promise<void> {
    switch (message.type) {
      case 'authenticate':
        await this.handleAuthentication(ws, message.payload);
        break;

      case 'ping':
        this.send(ws, { type: 'pong' });
        break;

      default:
        logger.warn(`Unknown message type: ${message.type}`);
        this.sendError(ws, 'Unknown message type');
    }
  }

  private async tryAuthenticateFromCookie(ws: WebSocketClient, request: IncomingMessage): Promise<void> {
    try {
      // Parse cookies from request headers
      const cookieHeader = request.headers.cookie;

      // Enhanced logging to debug cookie issues
      logger.info('WebSocket connection attempt', {
        hasCookieHeader: !!cookieHeader,
        cookieHeaderLength: cookieHeader?.length || 0,
        origin: request.headers.origin,
        host: request.headers.host,
        url: request.url,
        allCookies: cookieHeader ? cookieHeader.split(';').map(c => c.split('=')[0].trim()) : []
      });

      if (!cookieHeader) {
        logger.warn('No cookies found in WebSocket connection request', {
          origin: request.headers.origin,
          host: request.headers.host,
          headers: Object.keys(request.headers)
        });
        return;
      }

      // Extract auth_token from cookies
      const cookies = cookieHeader.split(';').map(c => c.trim());
      const authCookie = cookies.find(c => c.startsWith('auth_token='));

      if (!authCookie) {
        logger.warn('No auth_token cookie found in WebSocket connection', {
          availableCookies: cookies.map(c => c.split('=')[0]),
          origin: request.headers.origin
        });
        return;
      }

      const token = authCookie.split('=')[1];
      if (!token) {
        logger.debug('Empty auth_token cookie in WebSocket connection');
        return;
      }

      // Verify JWT token
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        logger.error('JWT_SECRET not configured');
        return;
      }

      const decoded = jwt.verify(token, jwtSecret) as { address?: string; walletAddress?: string };
      const walletAddress = (decoded.address || decoded.walletAddress)?.toLowerCase();

      if (!walletAddress) {
        logger.debug('Invalid token in cookie: wallet address not found');
        return;
      }

      // Associate wallet address with this connection
      ws.walletAddress = walletAddress;

      // Clear authentication timeout since we successfully authenticated
      if (ws.authTimeout) {
        clearTimeout(ws.authTimeout);
        ws.authTimeout = undefined;
      }

      // Add to clients map
      if (!this.clients.has(walletAddress)) {
        this.clients.set(walletAddress, new Set());
      }
      this.clients.get(walletAddress)!.add(ws);

      logger.info(`WebSocket auto-authenticated from cookie for wallet: ${walletAddress}`);

      // Send authentication success
      this.send(ws, {
        type: 'authenticated',
        payload: { walletAddress, source: 'cookie' }
      });
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        // This is expected when user has an expired session - log as debug, not error
        logger.debug('Expired token in cookie for WebSocket connection - user needs to refresh session');
        // Send error message to client so it knows not to reconnect
        this.sendError(ws, 'Authentication failed: token expired');
        // Close after a brief delay to ensure error message is sent
        setImmediate(() => {
          ws.close();
        });
      } else {
        logger.error('Error authenticating WebSocket from cookie:', error);
      }
      // Don't allow manual authentication attempts with expired tokens
    }
  }

  private async handleAuthentication(ws: WebSocketClient, payload: AuthenticatedMessage): Promise<void> {
    try {
      const { token } = payload;

      if (!token) {
        this.sendError(ws, 'Authentication token required');
        return;
      }

      // Verify JWT token
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        logger.error('JWT_SECRET not configured');
        this.sendError(ws, 'Server configuration error');
        return;
      }

      const decoded = jwt.verify(token, jwtSecret) as { address?: string; walletAddress?: string };
      const walletAddress = (decoded.address || decoded.walletAddress)?.toLowerCase();

      if (!walletAddress) {
        this.sendError(ws, 'Invalid token: wallet address not found');
        ws.close();
        return;
      }

      // Associate wallet address with this connection
      ws.walletAddress = walletAddress;

      // Clear authentication timeout since we successfully authenticated
      if (ws.authTimeout) {
        clearTimeout(ws.authTimeout);
        ws.authTimeout = undefined;
      }

      // Add to clients map
      if (!this.clients.has(walletAddress)) {
        this.clients.set(walletAddress, new Set());
      }
      this.clients.get(walletAddress)!.add(ws);

      logger.info(`WebSocket authenticated for wallet: ${walletAddress}`);

      // Send authentication success
      this.send(ws, {
        type: 'authenticated',
        payload: { walletAddress, source: 'manual' }
      });
    } catch (error: any) {
      // Expired tokens are expected behavior - log as debug, not error
      if (error.name === 'TokenExpiredError') {
        logger.debug('WebSocket authentication failed: token expired - user needs to refresh session');
        this.sendError(ws, 'Authentication failed: token expired');
      } else {
        logger.error('WebSocket authentication error:', error);
        this.sendError(ws, 'Authentication failed');
      }
      // Close after a brief delay to ensure error message is sent
      setImmediate(() => {
        ws.close();
      });
    }
  }

  private handleDisconnection(ws: WebSocketClient): void {
    if (ws.walletAddress) {
      const addressClients = this.clients.get(ws.walletAddress);
      if (addressClients) {
        addressClients.delete(ws);
        if (addressClients.size === 0) {
          this.clients.delete(ws.walletAddress);
        }
      }
      logger.info(`WebSocket disconnected for wallet: ${ws.walletAddress}`);
    } else {
      logger.debug('Unauthenticated WebSocket disconnected'); // Changed to debug to reduce log noise
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws: WebSocket) => {
        const client = ws as WebSocketClient;
        if (client.isAlive === false) {
          logger.info('Terminating inactive WebSocket connection');
          return client.terminate();
        }

        client.isAlive = false;
        client.ping();
      });
    }, 30000); // 30 seconds
  }

  public sendNotificationToUser(walletAddress: string, notification: Notification): void {
    const normalizedAddress = walletAddress.toLowerCase();
    const addressClients = this.clients.get(normalizedAddress);

    if (!addressClients || addressClients.size === 0) {
      logger.debug(`No active WebSocket connections for wallet: ${normalizedAddress}`);
      return;
    }

    const message = {
      type: 'notification',
      payload: notification
    };

    addressClients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        this.send(client, message);
      }
    });

    logger.info(`Notification sent via WebSocket to ${normalizedAddress}`);
  }

  public broadcastToAll(message: WebSocketMessage): void {
    this.wss.clients.forEach((client: WebSocket) => {
      if (client.readyState === WebSocket.OPEN) {
        this.send(client as WebSocketClient, message);
      }
    });
  }

  /**
   * Send a message to multiple specific wallet addresses
   * Used for broadcasting admin-specific events like subscription status changes
   */
  public sendToAddresses(addresses: string[], message: WebSocketMessage): void {
    let sentCount = 0;

    // Debug: Log what addresses we're trying to send to and what's in the clients map
    const connectedAddresses = Array.from(this.clients.keys());
    logger.debug('sendToAddresses called', {
      targetAddresses: addresses.map(a => a.toLowerCase()),
      connectedAddresses,
      messageType: message.type
    });

    addresses.forEach((address) => {
      const normalizedAddress = address.toLowerCase();
      const addressClients = this.clients.get(normalizedAddress);

      if (addressClients && addressClients.size > 0) {
        addressClients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            this.send(client, message);
            sentCount++;
          }
        });
      } else {
        logger.debug('No WebSocket clients found for address', { address: normalizedAddress });
      }
    });

    if (sentCount > 0) {
      logger.info(`WebSocket message sent to ${sentCount} client(s) across ${addresses.length} address(es)`, {
        type: message.type
      });
    } else {
      logger.warn('sendToAddresses: No clients found for any of the target addresses', {
        targetAddresses: addresses.map(a => a.toLowerCase()),
        connectedAddresses
      });
    }
  }

  private send(ws: WebSocketClient, message: WebSocketMessage): void {
    try {
      ws.send(JSON.stringify(message));
    } catch (error) {
      logger.error('Error sending WebSocket message:', error);
    }
  }

  private sendError(ws: WebSocketClient, error: string): void {
    this.send(ws, {
      type: 'error',
      payload: { error }
    });
  }

  public getConnectedClients(): number {
    return this.wss.clients.size;
  }

  public getAuthenticatedUsers(): number {
    return this.clients.size;
  }

  public isUserConnected(walletAddress: string): boolean {
    const normalizedAddress = walletAddress.toLowerCase();
    const addressClients = this.clients.get(normalizedAddress);
    return addressClients ? addressClients.size > 0 : false;
  }

  public close(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.wss.clients.forEach((client) => {
      client.close();
    });

    this.wss.close();
    logger.info('WebSocket manager closed');
  }

  /**
   * Get client IP address from request
   */
  private getClientIP(request: IncomingMessage): string {
    // Check x-forwarded-for header first (for proxies/load balancers)
    const forwardedFor = request.headers['x-forwarded-for'];
    if (forwardedFor) {
      const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
      return ips.split(',')[0].trim();
    }

    // Fallback to socket remote address
    return request.socket.remoteAddress || 'unknown';
  }

  /**
   * Check if client is within rate limit
   */
  private checkRateLimit(clientIP: string): boolean {
    const now = Date.now();
    const attempt = this.connectionAttempts.get(clientIP);

    if (!attempt || now > attempt.resetAt) {
      // First attempt or window expired - create new tracking
      this.connectionAttempts.set(clientIP, {
        count: 1,
        resetAt: now + this.ATTEMPT_WINDOW_MS
      });
      return true;
    }

    // Within window - check count
    if (attempt.count >= this.MAX_ATTEMPTS_PER_MINUTE) {
      return false; // Rate limit exceeded
    }

    // Increment count
    attempt.count++;
    return true;
  }

  /**
   * Periodically clean up expired attempt tracking
   */
  private startAttemptCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [ip, attempt] of this.connectionAttempts.entries()) {
        if (now > attempt.resetAt) {
          this.connectionAttempts.delete(ip);
        }
      }
    }, 60000); // Clean up every minute
  }
}
