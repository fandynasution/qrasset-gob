import { Request, Response } from "express";
import { GetDatanonQr, GetDataWhere, GetDataWithQr, UpdateDataPrint, DataQRSaving, GetDataWhereTrx } from '../models/FaAssetModel';
import { DataItem } from '../types/QrCodeTypes';
import fs from 'fs';
import path from 'path';
import logger from "../logger";
import multer from "multer";
import { console } from "inspector";
import { createLogger, format, transports } from "winston";

// Ensure the target directory exists
const uploadDir = path.join(__dirname, '../../storage/assetpicture');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true }); // Create the directory if it doesn't exist
}

// Set up multer storage configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir); // Specify the target directory for uploaded files
    },
    filename: (req, file, cb) => {
        const fileExtension = path.extname(file.originalname); // Get file extension
        const fileName = `${Date.now()}-${file.originalname}`; // Create a unique file name
        cb(null, fileName); // Set the file name to save
    },
});

// Set up multer to handle form-data (with a max of 10 files, if needed)
const upload = multer({ storage: storage });

// Folder log
const logDir = path.join(__dirname, '../../storage/log');

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

export const DatanonQr = async (req: Request, res: Response) => {
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
        const datanonQr = await GetDatanonQr();

        if (datanonQr.length === 0) {
            const errorMessage = "No data non QR found on Database";
            logger.info(errorMessage); // Log error
            return res.status(404).json({
                success: true,
                message: errorMessage,
            });
        }   
        
        logger.info('Success get Data non QR from Database');

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

export const DatawithQr = async (req: Request, res: Response) => {
    // Buat logger
    const logger = createLogger({
        level: 'info',
        format: format.combine(
            format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            format.printf(({ timestamp, level, message }) => `${timestamp} [${level.toUpperCase()}]: ${message}`)
        ),
        transports: [
            new transports.File({ filename: path.join(logDir, getLogFileName()) }) // Simpan ke file log harian
        ]
    });
    try {
        const dataWithQr = await GetDataWithQr();

        if (dataWithQr.length === 0) {
            const errorMessage = "No data with QR found on Database";
            logger.error(errorMessage); // Log error
            return res.status(404).json({
                success: true,
                message: errorMessage,
            });
        }

        logger.info('Success get Data with QR from Database');
        
        res.status(200).json({
            success: true,
            message: "Success",
            data: dataWithQr
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

export const DataWhere = async (req: Request, res: Response) => {
    // Buat logger
    const logger = createLogger({
        level: 'info',
        format: format.combine(
            format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            format.printf(({ timestamp, level, message }) => `${timestamp} [${level.toUpperCase()}]: ${message}`)
        ),
        transports: [
            new transports.File({ filename: path.join(logDir, getLogFileName()) }) // Simpan ke file log harian
        ]
    });

    const dataWhereD = req.body;

    const dataArray: DataItem[] = Array.isArray(dataWhereD) ? dataWhereD : [dataWhereD];

    // Validate that each entry has the required fields
    const hasRequiredFields = (detail: DataItem) =>
        detail.entity_cd && detail.reg_id;

    // Check for required fields in each entry
    if (!dataArray.every(hasRequiredFields)) {
        const errorMessage = "entity_cd and reg_id are required";
        logger.error(errorMessage); // Log error
            
        return res.status(400).json({
            success: false,
            message: errorMessage,
        });
    }
    try {
        // Log each entry
        dataArray.forEach((dataItem) => {
            logger.info(`Processing data Where for entity_cd: ${dataItem.entity_cd} and reg_id: ${dataItem.reg_id}`);
        });

        // Call the function to update the data in the database
        const result = await GetDataWhere(dataArray);

        // Log the successful update to the database
        logger.info(`Success get Data from Database`);

        res.status(200).json({
            success: true,
            message: "Success",
            result,
        });
    } catch (error: unknown) {
        if (error instanceof Error) {
            logger.error(`Failed to Fetch Data Print: ${error instanceof Error ? error.message : error}`);
        
            res.status(500).json({
                success: false,
                message: "Failed to Fetch Data Print",
                error: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        } else {
            logger.error(`Failed to Fetch Data Print: ${error instanceof Error ? error.message : error}`);
        
            res.status(500).json({
                success: false,
                message: "Failed to Fetch Data Print",
                error: "An unknown error occurred"
            });
        }
    }
}

export const DataUpdatePrint = async (req: Request, res: Response) => {
    // Buat logger
    const logger = createLogger({
        level: 'info',
        format: format.combine(
            format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            format.printf(({ timestamp, level, message }) => `${timestamp} [${level.toUpperCase()}]: ${message}`)
        ),
        transports: [
            new transports.File({ filename: path.join(logDir, getLogFileName()) }) // Simpan ke file log harian
        ]
    });
    const printUpdateDataD = req.body;

    // Check if the input is an array or a single object, then normalize it to an array
    const dataArray: DataItem[] = Array.isArray(printUpdateDataD) ? printUpdateDataD : [printUpdateDataD];

    // Validate that each entry has the required fields
    const hasRequiredFields = (detail: DataItem) =>
        detail.entity_cd && detail.reg_id;

    // Check for required fields in each entry
    if (!dataArray.every(hasRequiredFields)) {
        const errorMessage = "entity_cd and reg_id are required";
        logger.error(errorMessage); // Log error
            
        return res.status(400).json({
            success: false,
            message: errorMessage,
        });
    }

    try {
        // Log each entry
        dataArray.forEach((dataItem) => {
            logger.info(`Processing data Update Print for entity_cd: ${dataItem.entity_cd} and reg_id: ${dataItem.reg_id}`);
        });

        const result = await GetDataWhere(dataArray);

        if (Array.isArray(result) && result.length === 0) {
            logger.warn(`No records found`);
            return res.status(404).json({
                success: false,
                message: 'No records found',
            });
        }

        // Call the function to update the data in the database
        const resultup = await UpdateDataPrint(dataArray);

        // Log the successful update to the database
        logger.info(`Success update data to Database`);

        res.status(200).json({
            resultup
        });
    } catch (error: unknown) {
        if (error instanceof Error) {
            logger.error(`Failed to update Data Print: ${error instanceof Error ? error.message : error}`);
        
            res.status(500).json({
                success: false,
                message: "Failed to update Data Print",
                error: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        } else {
            logger.error(`Failed to update Data Print: ${error instanceof Error ? error.message : error}`);
        
            res.status(500).json({
                success: false,
                message: "Failed to update Data Print",
                error: "An unknown error occurred"
            });
        }
    }
}

export const DataWhereTrx = async (req: Request, res: Response) => {
    // Buat logger
    const logger = createLogger({
        level: 'info',
        format: format.combine(
            format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            format.printf(({ timestamp, level, message }) => `${timestamp} [${level.toUpperCase()}]: ${message}`)
        ),
        transports: [
            new transports.File({ filename: path.join(logDir, getLogFileName()) }) // Simpan ke file log harian
        ]
    });

    const dataWhereD = req.body;

    const dataArray: DataItem[] = Array.isArray(dataWhereD) ? dataWhereD : [dataWhereD];

    // Validate that each entry has the required fields
    const hasRequiredFields = (detail: DataItem) =>
        detail.entity_cd && detail.reg_id;

    // Check for required fields in each entry
    if (!dataArray.every(hasRequiredFields)) {
        const errorMessage = "entity_cd and reg_id are required";
        logger.error(errorMessage); // Log error
            
        return res.status(400).json({
            success: false,
            message: errorMessage,
        });
    }
    try {
        // Log each entry
        dataArray.forEach((dataItem) => {
            logger.info(`Processing data Where Trx for entity_cd: ${dataItem.entity_cd} and reg_id: ${dataItem.reg_id}`);
        });

        // Call the function to update the data in the database
        const result = await GetDataWhereTrx(dataArray);

        // Log the successful update to the database
        logger.info(`Success get Data from Database`);

        res.status(200).json({
            success: true,
            message: "Success",
            result,
        });
    } catch (error: unknown) {
        if (error instanceof Error) {
            logger.error(`Failed to Fetch Data Print: ${error instanceof Error ? error.message : error}`);
        
            res.status(500).json({
                success: false,
                message: "Failed to Fetch Data Print",
                error: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        } else {
            logger.error(`Failed to Fetch Data Print: ${error instanceof Error ? error.message : error}`);
        
            res.status(500).json({
                success: false,
                message: "Failed to Fetch Data Print",
                error: "An unknown error occurred"
            });
        }
    }
}