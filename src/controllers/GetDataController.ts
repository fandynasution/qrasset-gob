import { Request, Response } from "express";
import { GetDataStaff, saveDataStaffAsset, GetDataStaffId, GetDataStaffEmail } from "../models/DataStaffModel"
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { DataItem } from '../types/QrCodeTypes';
import logger from "../logger";
import * as ftp from 'basic-ftp';
import { createLogger, format, transports } from "winston";
import { getFtpDetails } from '../models/QrCodeModel';

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

export const getStaffData = async (req: Request, res: Response) => {
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
        const datanonQr = await GetDataStaff();

        if (datanonQr.length === 0) {
            const errorMessage = "No data Staff found on Database";
            logger.info(errorMessage); // Log error
            return res.status(404).json({
                success: true,
                message: errorMessage,
            });
        }   
        
        logger.info('Success get Data Staff from Database');

        res.status(200).json({
            success: true,
            message: "Success",
            data: datanonQr
        });
    } catch (error) {
        logger.error(`Failed to Fetch Data: ${error instanceof Error ? error.message : error}`);
        res.status(500).json({
            success: false,
            message: "Failed to Fetch Data",
            error: error instanceof Error ? error.message : "Unknown error occurred",
        });
    }
}

export const getStaffDataId = async (req: Request, res: Response) => {
    const logDir = path.join(__dirname, '..', 'logs'); // Tambahkan logDir
    const logger = createLogger({
        level: 'info',
        format: format.combine(
            format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            format.printf(({ timestamp, level, message }) => `${timestamp} [${level.toUpperCase()}]: ${message}`)
        ),
        transports: [
            new transports.File({ filename: path.join(logDir, 'daily.log') }) // Simpan ke file log harian
        ]
    });

    try {
        const { staff_id } = req.body; // Ambil staff_id dari req.params
        const datanonQr = await GetDataStaffId(staff_id); // Panggil GetDataStaffId dengan staff_id

        if (datanonQr.length === 0) {
            const errorMessage = "No data Staff found on Database";
            logger.info(errorMessage); // Log info
            return res.status(404).json({
                success: true,
                message: errorMessage,
            });
        }

        logger.info('Success get Data Staff from Database');

        res.status(200).json({
            success: true,
            message: "Success",
            data: datanonQr
        });
    } catch (error) {
        logger.error(`Failed to Fetch Data: ${error instanceof Error ? error.message : error}`);
        res.status(500).json({
            success: false,
            message: "Failed to Fetch Data",
            error: error instanceof Error ? error.message : "Unknown error occurred",
        });
    }
};

export const getStaffDataEmail = async (req: Request, res: Response) => {
    const logDir = path.join(__dirname, '..', 'logs'); // Tambahkan logDir
    const logger = createLogger({
        level: 'info',
        format: format.combine(
            format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            format.printf(({ timestamp, level, message }) => `${timestamp} [${level.toUpperCase()}]: ${message}`)
        ),
        transports: [
            new transports.File({ filename: path.join(logDir, 'daily.log') }) // Simpan ke file log harian
        ]
    });

    try {
        const { email } = req.body; // Ambil staff_id dari req.params
        const datanonQr = await GetDataStaffEmail(email); // Panggil GetDataStaffId dengan staff_id

        if (datanonQr.length === 0) {
            const errorMessage = "No data Staff found on Database";
            logger.info(errorMessage); // Log info
            return res.status(404).json({
                success: true,
                message: errorMessage,
            });
        }

        logger.info('Success get Data Staff from Database');

        res.status(200).json({
            success: true,
            message: "Success",
            data: datanonQr
        });
    } catch (error) {
        logger.error(`Failed to Fetch Data: ${error instanceof Error ? error.message : error}`);
        res.status(500).json({
            success: false,
            message: "Failed to Fetch Data",
            error: error instanceof Error ? error.message : "Unknown error occurred",
        });
    }
};

export const updateStaffData = async (req: Request, res: Response) => {
    const storagePath = path.join(__dirname, '..', 'storage', 'qr');
    
    if (!fs.existsSync(storagePath)) {
        fs.mkdirSync(storagePath, { recursive: true });
    }

    const logDir = path.join(__dirname, '..', 'logs'); // Tambahkan logDir
    const logger = createLogger({
        level: 'info',
        format: format.combine(
            format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            format.printf(({ timestamp, level, message }) => `${timestamp} [${level.toUpperCase()}]: ${message}`)
        ),
        transports: [
            new transports.File({ filename: path.join(logDir, 'daily.log') })
        ]
    });

    const dataWhereD = req.body;
    const dataArray = Array.isArray(dataWhereD) ? dataWhereD : [dataWhereD];

    const validateFields = (details: { 
        entity_cd: string; 
        reg_id: string; 
        staff_id: string; 
        div_cd: string; 
        dept_cd: string;
    }) => {
        const missingFields = [];
        if (!details.entity_cd) missingFields.push("entity_cd cannot be empty");
        if (!details.reg_id) missingFields.push("reg_id cannot be empty");
        if (!details.staff_id) missingFields.push("staff_id cannot be empty");
        if (!details.div_cd) missingFields.push("div_cd cannot be empty");
        if (!details.dept_cd) missingFields.push("dept_cd cannot be empty");
        return missingFields;
    };

    const invalidEntries = dataArray.map((detail, index) => {
        const missingFields = validateFields(detail);
        return { index, missingFields };
    }).filter(entry => entry.missingFields.length > 0);

    if (invalidEntries.length > 0) {
        const ErrorField = invalidEntries.map(entry => entry.missingFields).flat();

        res.status(400).json({
            success: false,
            message: 'Validation failed',
            ErrorField
        });
        return;
    }

    const { entity_cd, reg_id, staff_id, div_cd, dept_cd } = req.body;

    try {
        const dataStaffSave = await saveDataStaffAsset(entity_cd, reg_id, staff_id, div_cd, dept_cd);

        logger.info('Success update Data Staff on Database');

        res.status(200).json({
            success: true,
            message: "Success",
            data: dataStaffSave
        });
    } catch (error) {
        if (error instanceof Error) {
            logger.error(`Error updating database for reg_id: ${reg_id}. Error: ${error.message}`);
            res.status(400).json({
                success: false,
                message: error.message,
                reg_id,
            });
        } else {
            logger.error(`Error updating database for reg_id: ${reg_id}. Error: Unknown error occurred.`);
            res.status(400).json({
                success: false,
                message: "An unknown error occurred.",
                reg_id,
            });
        }
    }
};