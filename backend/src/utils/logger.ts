// backend/src/utils/logger.ts
import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Tell winston that you want to link the colors
winston.addColors(colors);

// Choose the aspect of your log customizing the log format
const format = winston.format.combine(
  // Add the message timestamp with the preferred format
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  // Define the format of the message showing the timestamp, the level and the message
  winston.format.printf((info) => {
    const { timestamp, level, message, ...meta } = info;
    const metaString = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level}]: ${message} ${metaString}`;
  }),
);

// Console format with colors
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  format
);

// File format without colors
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json()
);

// Define which transports the logger must use to print out messages
const transports: winston.transport[] = [
  // Allow the use the console to print the messages
  new winston.transports.Console({
    format: consoleFormat
  }),
];

// Add file transports in production
if (process.env.NODE_ENV === 'production') {
  // Create logs directory if it doesn't exist
  const logDir = path.join(process.cwd(), 'logs');
  
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  transports.push(
    // Allow to print all the error level messages inside the error.log file
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      format: fileFormat
    }),
    // Allow to print all the messages inside the combined.log file
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      format: fileFormat
    })
  );
}

// Create the logger instance that has to be exported and used to log messages
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  levels,
  format: fileFormat, // Default format for non-console transports
  transports,
  // Do not exit on handled exceptions
  exitOnError: false,
});

// Extend logger with custom methods for RepairCoin specific logging
interface RepairCoinLogger extends winston.Logger {
  webhook: (message: string, meta?: any) => void;
  transaction: (message: string, meta?: any) => void;
  security: (message: string, meta?: any) => void;
  performance: (message: string, meta?: any) => void;
}

const extendedLogger = logger as RepairCoinLogger;

// Custom logging methods
extendedLogger.webhook = (message: string, meta?: any) => {
  logger.info(`[WEBHOOK] ${message}`, meta);
};

extendedLogger.transaction = (message: string, meta?: any) => {
  logger.info(`[TRANSACTION] ${message}`, meta);
};

extendedLogger.security = (message: string, meta?: any) => {
  logger.warn(`[SECURITY] ${message}`, meta);
};

extendedLogger.performance = (message: string, meta?: any) => {
  logger.info(`[PERFORMANCE] ${message}`, meta);
};

export { extendedLogger as logger };