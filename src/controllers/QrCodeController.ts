import { Request, Response } from "express";
import { GetDataGenerate, QrCodeDataInsert } from "../models/QrCodeModel";
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
            let ftpUrl: string | null = null;
            const qrContent = [
                {
                    entity_cd: item.entity_cd.trim(),
                    reg_id: item.reg_id.trim()
                }
            ];
            
            const qrCodeSvg = await QRCode.toString(JSON.stringify(qrContent), { type: 'svg' });

            // Generate a file name using reg_id and replace "/" with "_"
            const fileName = `${item.entity_cd}_${item.reg_id.replace(/\//g, '_')}.svg`;
            const filePath = path.join(storagePath, fileName);

            // Save the SVG string to a file
            fs.writeFileSync(filePath, qrCodeSvg);
            const ftpClient = new ftp.Client();
            ftpClient.ftp.verbose = true;

            const ftpDetails = await getFtpDetails();

            await ftpClient.access({
                host: ftpDetails.FTPServer,
                port: parseInt(ftpDetails.FTPPort, 10),
                user: ftpDetails.FTPUser,
                password: ftpDetails.FTPPassword,
                secure: false
            });

            const remoteFolderPath = `/ifca-att/AssetQrCode/`;
            await ftpClient.ensureDir(remoteFolderPath);
            logger.info(`Ensured folder exists: ${remoteFolderPath}`);

            const remoteFilePath = `${remoteFolderPath}${fileName}`;
            await ftpClient.uploadFrom(filePath, remoteFilePath);
            logger.info(`File uploaded to FTP: ${remoteFilePath}`);

            ftpUrl = `${ftpDetails.URLPDF}${remoteFolderPath}${fileName}`;

            console.log(ftpUrl);

            fs.unlinkSync(filePath);
            logger.info(`Temporary file deleted: ${filePath}`);
            ftpClient.close();

            return {
                entity_cd: item.entity_cd,
                reg_id: item.reg_id,
                qr_url_attachment: ftpUrl, // File path to be stored in DB
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

export const generateOneQrCode = async (req: Request, res: Response) => {
    // Setup logger
    const logger = createLogger({
        level: 'info',
        format: format.combine(
            format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            format.printf(({ timestamp, level, message }) => `${timestamp} [${level.toUpperCase()}]: ${message}`)
        ),
        transports: [new transports.File({ filename: path.join(logDir, getLogFileName()) })]
    });

    const dataGenerate = req.body;
    const dataArray = Array.isArray(dataGenerate) ? dataGenerate : [dataGenerate];

    const validateFields = (details: { entity_cd: string; reg_id: string }) => {
        const missingFields = [];
        if (!details.entity_cd) missingFields.push("entity_cd");
        if (!details.reg_id) missingFields.push("reg_id");
        return missingFields;
    };

    // Validate each entry
    const invalidEntries = dataArray.map((detail, index) => ({
        index,
        missingFields: validateFields(detail)
    })).filter(entry => entry.missingFields.length > 0);

    if (invalidEntries.length > 0) {
        const errorDetails = invalidEntries
            .map(entry => {
                const missingFields = entry.missingFields;
                return missingFields.length === 1
                    ? `${missingFields[0]} is required`
                    : `${missingFields.slice(0, -1).join(", ")} & ${missingFields.slice(-1)} are required`;
            })
            .join("; ");

        const errorMessage = `Generate failed. ${errorDetails}`;
        logger.error(errorMessage);

        return res.status(400).json({
            success: false,
            message: errorMessage
        });
    }

    try {
        const filteredDataWithQRCode = [];

        for (const dataItem of dataArray) {
            const { entity_cd, reg_id } = dataItem;
            let ftpUrl: string | null = null;
            try {
                logger.info(`Generating QR for entity_cd: ${entity_cd}, reg_id: ${reg_id}`);

                const qrContent = [{ entity_cd: entity_cd.trim(), reg_id: reg_id.trim() }];
                const qrCodeSvg = await QRCode.toString(JSON.stringify(qrContent), { type: 'svg' });
                const fileName = `${entity_cd}_${reg_id.replace(/\//g, '_')}.svg`;

                const tempDir = path.join(__dirname, '../../storage/temppicture');
                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true });
                    logger.info(`Created directory: ${tempDir}`);
                }

                const tempFilePath = path.join(tempDir, fileName);
                fs.writeFileSync(tempFilePath, qrCodeSvg);
                logger.info(`Temporary file created at: ${tempFilePath}`);

                const ftpClient = new ftp.Client();
                ftpClient.ftp.verbose = true;

                const ftpDetails = await getFtpDetails();

                await ftpClient.access({
                    host: ftpDetails.FTPServer,
                    port: parseInt(ftpDetails.FTPPort, 10),
                    user: ftpDetails.FTPUser,
                    password: ftpDetails.FTPPassword,
                    secure: false
                });

                const remoteFolderPath = `/ifca-att/AssetQrCode/`;
                await ftpClient.ensureDir(remoteFolderPath);
                logger.info(`Ensured folder exists: ${remoteFolderPath}`);

                const remoteFilePath = `${remoteFolderPath}${fileName}`;
                await ftpClient.uploadFrom(tempFilePath, remoteFilePath);
                logger.info(`File uploaded to FTP: ${remoteFilePath}`);

                ftpUrl = `${ftpDetails.URLPDF}${remoteFolderPath}${fileName}`;

                fs.unlinkSync(tempFilePath);
                logger.info(`Temporary file deleted: ${tempFilePath}`);
                ftpClient.close();

                // Add data with QR URL to the array for database insertion
                filteredDataWithQRCode.push({
                    entity_cd: entity_cd,
                    reg_id: reg_id,
                    qr_url_attachment: ftpUrl, // File path to be stored in DB
                });

            } catch (ftpError) {
                logger.error(`FTP upload failed for entity_cd: ${entity_cd}, reg_id: ${reg_id}. Error: ${ftpError}`);
            }
        }

        // Insert the filtered data with QR code URLs into the database
        if (filteredDataWithQRCode.length > 0) {
            await QrCodeDataInsert(filteredDataWithQRCode);
            logger.info("All QR codes successfully generated and saved to the database.");
        } else {
            logger.warn("No valid QR codes generated for database insertion.");
        }

        res.status(200).json({
            success: true,
            message: "QR Codes generated successfully",
        });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
        logger.error(`Error generating QR Codes: ${errorMessage}`);

        res.status(500).json({
            success: false,
            message: "Failed to generate QR Codes",
            error: errorMessage
        });
    }
};