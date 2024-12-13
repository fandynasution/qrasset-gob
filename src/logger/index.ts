import path from 'path';
import winston from 'winston';
import moment from 'moment-timezone';

const todayDate = moment().tz('Asia/Jakarta').format('YYYY-MM-DD');
const logsDirectory = path.join(__dirname, '..', '..', 'logs', todayDate);
const errorLogPath = path.join(logsDirectory, 'error.log');
const successLogPath = path.join(logsDirectory, 'success.log');
const combinedLogPath = path.join(logsDirectory, 'combined.log');

const logger = winston.createLogger({
    level: 'info', // Default log level
    format: winston.format.combine(
        winston.format.timestamp({
            format: () => moment().tz('Asia/Jakarta').format('YYYY-MM-DD HH:mm:ss'), // Format in UTC+7
        }),
        winston.format.printf(({ timestamp, level, message }) => {
            return `${timestamp} [${level.toUpperCase()}]: ${message}`;
        }) // Custom log message format
    ),
    transports: [
        new winston.transports.File({ filename: errorLogPath, level: 'error' }), // Error logs
        new winston.transports.File({ filename: successLogPath, level: 'info' }), // Info logs
        new winston.transports.File({ filename: combinedLogPath }) // All logs
    ]
});


// Optionally log to console during development
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({ format: winston.format.simple() }));
}

export default logger;