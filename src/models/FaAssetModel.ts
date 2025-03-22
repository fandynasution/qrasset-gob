import { poolPromise } from '../lib/db';
import { Request, Response } from "express";
import * as sql from 'mssql';
import { DataItem } from '../types/QrCodeTypes';
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

export const GetDatanonQr = async () => {
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
            SELECT * FROM mgr.v_fa_fasset_qrdata WHERE qr_url_attachment IS NULL OR qr_url_attachment = ''
        `);
        return result.recordset;
    } catch (error) {
        logger.error("Error fetching data", error);
        throw error;
    }
};

export const GetDataWithQr = async () => {
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
            SELECT * FROM mgr.v_fa_fasset_qrdata WHERE qr_url_attachment IS NOT NULL AND qr_url_attachment <> ''
        `);
        return result.recordset;
    } catch (error) {
        logger.error("Error fetching data", error);
        throw error;
    }
};

export const GetDataWhere = async (data: DataItem[]) => {
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
    
    if (data.length === 0) {
        return { message: "No records to Fetch." };
    }

    let pool;
    let transaction;
    const resultData: any[] = [];  // To store the results of each query

    try {
        const pool = await poolPromise;
        transaction = pool.transaction();
        await transaction.begin();

        for (const entry of data) {
            const result = await transaction.request()
                .input('entity_cd', sql.VarChar, entry.entity_cd)
                .input('reg_id', sql.VarChar, entry.reg_id)
                .query(`
                    SELECT * 
                    FROM mgr.v_fa_fasset_qrdata 
                    WHERE entity_cd = @entity_cd 
                    AND reg_id = @reg_id
                `);

            // Store the result of each query in the resultData array
            resultData.push(...result.recordset);  // Assuming `recordset` contains the result
        }

        await transaction.commit();
        return resultData;  // Include the result data in the response        
    } catch (error) {
        logger.error("Error fetching data", error);
        throw error;  // Rethrow the error to be handled in the controller
    }
}

export const UpdateDataPrint = async (data: DataItem[]) => {
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
    
    if (data.length === 0) {
        return { message: "No records to Update." };
    }

    let pool;
    let transaction;

    try {
        const pool = await poolPromise;
        transaction = pool.transaction();
        await transaction.begin();

        for (const entry of data) {
            await transaction.request()
                .input('entity_cd', sql.VarChar, entry.entity_cd)
                .input('reg_id', sql.VarChar, entry.reg_id)
                .query(`
                    update mgr.fa_fasset set isprint = 'Y'
                    where entity_cd = @entity_cd and reg_id = @reg_id
                `);
        }

        await transaction.commit();
        return {
            success: true,
            message: "All records updated successfully."
        };
    } catch (error) {
        logger.error("Error updating data", error);
        throw error;  // Rethrow the error to be handled in the controller
    }
}

export const DataQRSaving = async (data: DataItem[]) => {
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
    
    if (data.length === 0) {
        return { message: "No records to Update." };
    }

    let pool;
    let transaction;

    try {
        const pool = await poolPromise;
        transaction = pool.transaction();
        await transaction.begin();

        for (const entry of data) {
            
        }
        
        return {
            success: true,
            message: "All records inserted successfully."
        };
    } catch (error) {
        logger.error("Error Inserting data", error);
        throw error;  // Rethrow the error to be handled in the controller
    }
}

export const GetDataWhereTrx = async (data: DataItem[]) => {
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
    
    if (data.length === 0) {
        return { message: "No records to Fetch." };
    }

    let pool;
    let transaction;
    const resultData: any[] = [];  // To store the results of each query

    try {
        const pool = await poolPromise;
        transaction = pool.transaction();
        await transaction.begin();

        for (const entry of data) {
            const result = await transaction.request()
                .input('entity_cd', sql.VarChar, entry.entity_cd)
                .input('reg_id', sql.VarChar, entry.reg_id)
                .query(`
                    SELECT * 
                    FROM mgr.fa_fasset_trx
                    WHERE entity_cd = @entity_cd 
                    AND reg_id = @reg_id
                    ORDER by trx_date desc
                `);

            // Store the result of each query in the resultData array
            resultData.push(...result.recordset);  // Assuming `recordset` contains the result
        }

        await transaction.commit();
        return resultData;  // Include the result data in the response        
    } catch (error) {
        logger.error("Error fetching data", error);
        throw error;  // Rethrow the error to be handled in the controller
    }
}