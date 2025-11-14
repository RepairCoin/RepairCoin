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

  constructor(wss: WebSocketServer) {
    this.wss = wss;
    this.clients = new Map();
    this.heartbeatInterval = null;
    this.initialize();
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

    logger.debug('New WebSocket connection established'); // Changed to debug to reduce noise

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
      if (!cookieHeader) {
        logger.debug('No cookies found in WebSocket connection request');
        return;
      }

      // Extract auth_token from cookies
      const cookies = cookieHeader.split(';').map(c => c.trim());
      const authCookie = cookies.find(c => c.startsWith('auth_token='));

      if (!authCookie) {
        logger.debug('No auth_token cookie found in WebSocket connection');
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
}
