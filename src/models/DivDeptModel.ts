import { poolPromise } from '../lib/db';
import * as sql from 'mssql';
import fs from 'fs';
import path from 'path';
import logger from "../logger";
import { createLogger, format, transports } from "winston";

// Folder log
const logDir = path.join(__dirname, '../storage/log');

// Pastikan folder log ada
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// Format tanggal untuk nama file
const getLogFileName = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `log-${year}-${month}-${day}.txt`;
};

export const GetDataDiv = async () => {
    const storagePath = path.join(__dirname, '..', 'storage', 'qr'); 
            
    if (!fs.existsSync(storagePath)) {
        fs.mkdirSync(storagePath, { recursive: true }); // Create the directory if it doesn't exist
    }

    
    // Buat logger
    const logger = createLogger({
        level: 'info',
        format: format.combine(
            format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            format.printf(({ timestamp, level, message }) => `${timestamp} [${level.toUpperCase()}]: ${message}`)
        ),
        transports: [
            new transports.File({ filename: path.join(logDir, getLogFileName()) }), // Simpan ke file log harian
        ]
    });
        
    try {
        const pool = await poolPromise;  // Get the pool
        const result = await pool.request().query(`
            SELECT div_cd, descs FROM mgr.cf_div
        `);
        return result.recordset;
    } catch (error) {
        logger.error("Error fetching data", error);
        throw error;
    }
};

export const GetDataDept = async () => {
    const storagePath = path.join(__dirname, '..', 'storage', 'qr'); 
            
    if (!fs.existsSync(storagePath)) {
        fs.mkdirSync(storagePath, { recursive: true }); // Create the directory if it doesn't exist
    }

    
    // Buat logger
    const logger = createLogger({
        level: 'info',
        format: format.combine(
            format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            format.printf(({ timestamp, level, message }) => `${timestamp} [${level.toUpperCase()}]: ${message}`)
        ),
        transports: [
            new transports.File({ filename: path.join(logDir, getLogFileName()) }), // Simpan ke file log harian
        ]
    });
        
    try {
        const pool = await poolPromise;  // Get the pool
        const result = await pool.request().query(`
            SELECT dept_cd, descs FROM mgr.cf_dept
        `);
        return result.recordset;
    } catch (error) {
        logger.error("Error fetching data", error);
        throw error;
    }
};