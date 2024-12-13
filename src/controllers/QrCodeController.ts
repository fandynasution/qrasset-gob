import { Request, Response } from "express";
import { GetDataGenerate, QrCodeDataInsert } from "../models/QrCodeModel";
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { DataItem } from '../types/QrCodeTypes';
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

export const generateAndSaveQrCode = async (req: Request, res: Response) => {
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
        const dataQr = await GetDataGenerate();

        // Check if no data is returned
        if (dataQr.length === 0) {
            const errorMessage = "No data found for QR code generation.";
            logger.error(errorMessage); // Log error
            return res.status(404).json({
                success: false,
                message: errorMessage
            });
        }

        const filteredDataWithQRCode = await Promise.all(dataQr.map(async (item: any) => {
            const qrContent = [
                {
                    entity_cd: item.entity_cd.trim(),
                    reg_id: item.reg_id.trim()
                }
            ];
            
            const qrCodeSvg = await QRCode.toString(JSON.stringify(qrContent), { type: 'svg' });

            // Generate a file name using reg_id and replace "/" with "_"
            const fileName = `${item.reg_id.replace(/\//g, '_')}.svg`;
            const filePath = path.join(storagePath, fileName);

            // Save the SVG string to a file
            fs.writeFileSync(filePath, qrCodeSvg);

            // Prepare the data for database insertion
            const urlPath = `${process.env.API_SWAGGER_URL}:${process.env.API_SWAGGER_PORT}/api/qrasset/qr/${fileName}`;
            
            // Log success for each QR code
            logger.info(`Generated QR code for reg_id: ${item.reg_id}, saved to: ${filePath}`);

            return {
                entity_cd: item.entity_cd,
                reg_id: item.reg_id,
                qr_url_attachment: urlPath, // File path to be stored in DB
            };
        }));

        // Insert or update the QR code data into the database
        const data = await QrCodeDataInsert(filteredDataWithQRCode);
        logger.info("All QR codes successfully generated and saved to the database."); // Log success

        res.status(200).json({
            success: true,
            message: "Success Generate QR Code" // Optional: To send the DB insert result if needed
        });
    } catch (error) {
        logger.error(`Error during QR code generation: ${error instanceof Error ? error.message : error}`);
        res.status(500).json({
            success: false,
            message: "Failed to generate or save QR codes",
            error: error instanceof Error ? error.message : "Unknown error occurred",
        });
    }
};
