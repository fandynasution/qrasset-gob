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

export const GetDataStaff = async () => {
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
            SELECT * FROM mgr.v_fa_fasset_staff_data
        `);
        return result.recordset;
    } catch (error) {
        logger.error("Error fetching data", error);
        throw error;
    }
};

export const GetDataStaffId = async (staff_id: string) => {
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
        const result = await pool.request()
            .input('staff_id', sql.VarChar, staff_id)
            .query(`
                SELECT * FROM mgr.v_fa_fasset_staff_data
                WHERE staff_id = @staff_id
            `);
        return result.recordset;
    } catch (error) {
        logger.error("Error fetching data", error);
        throw error;
    }
};

export const GetDataStaffEmail = async (email: string) => {
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
        const result = await pool.request()
            .input('email', sql.VarChar, email)
            .query(`
                SELECT * FROM mgr.v_fa_fasset_staff_data
                WHERE email_add = @email
            `);
        return result.recordset;
    } catch (error) {
        logger.error("Error fetching data", error);
        throw error;
    }
};

export const saveDataStaffAsset = async (
    entity_cd: string, 
    reg_id: string,
    staff_id: string, 
    div_cd: string,
    dept_cd: string,
) => {
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
        const pool = await poolPromise;
        const result = await pool.request()
            .input('entity_cd', sql.VarChar, entity_cd)
            .input('reg_id', sql.VarChar, reg_id)
            .input('staff_id', sql.VarChar, staff_id || null)
            .input('div_cd', sql.VarChar, div_cd || null)
            .input('dept_cd', sql.VarChar, dept_cd || null)
            .query(`
                UPDATE mgr.fa_fasset SET staff_id = @staff_id, div_cd = @div_cd, dept_cd = @dept_cd
                WHERE entity_cd = @entity_cd AND reg_id = @reg_id
            `);
        return result;
    } catch (error) {
        logger.error("Error updating data for Staff:", error);
        throw error;
    }
};