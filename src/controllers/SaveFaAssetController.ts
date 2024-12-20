import { Request, Response } from "express";
import fs from 'fs';
import path from 'path';
import multer from "multer";
import * as ftp from 'basic-ftp';
import { createLogger, format, transports } from "winston";
import { checkAndUpdateAsset, syncToFassetTrx } from '../models/SaveFaAssetModel';
import { checkAndUpdate, UpdatetoFassetTrx } from '../models/FaAssetSaveModel';
import { getFtpDetails } from '../models/QrCodeModel';

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

export const UpdateAsset = async (req: Request, res: Response) => {
    // Create logger
    const logger = createLogger({
        level: 'info',
        format: format.combine(
            format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            format.printf(({ timestamp, level, message }) => `${timestamp} [${level.toUpperCase()}]: ${message}`)
        ),
        transports: [
            new transports.File({ filename: path.join(logDir, getLogFileName()) }) // Save to daily log file
        ]
    });

    const dataWhereD = req.body;
    const dataArray = Array.isArray(dataWhereD) ? dataWhereD : [dataWhereD];

    // Validate that each entry has the required fields
    const validateFields = (details: { entity_cd: string; reg_id: string; location_map: string; files: string[]; status_review: string }) => {
        const missingFields = [];
        if (!details.entity_cd) missingFields.push("entity_cd cannot be empty");
        if (!details.reg_id) missingFields.push("reg_id cannot be empty");
        if (!details.location_map) missingFields.push("location_map cannot be empty");
        if (!details.files || details.files.length < 1) {
            missingFields.push("At least 1 file");
        } else if (details.files.length > 3) {
            missingFields.push("No more than 3 files allowed");
        }
        if (!details.status_review) missingFields.push("status_review cannot be empty");
        return missingFields;
    };

    // Check all entries in dataArray
    const invalidEntries = dataArray.map((detail, index) => {
        const missingFields = validateFields(detail);
        return { index, missingFields };
    }).filter(entry => entry.missingFields.length > 0);

    if (invalidEntries.length > 0) {
        const ErrorField = invalidEntries.flatMap(entry => entry.missingFields);

        res.status(400).json({
            success: false,
            message: 'Validation failed',
            ErrorField
        });
        return;
    }

    try {
        for (const dataItem of dataArray) {
            const { entity_cd, reg_id, files, status_review, notes, location_map, audit_status } = dataItem;

            logger.info(`Processing Update data for entity_cd: ${entity_cd} and reg_id: ${reg_id}`);

            // Ensure reg_id is sanitized for file names
            const sanitizedRegId = reg_id.replace(/\//g, "_");

            // Process each file
            const filePaths = []; // To store file paths for update
            const ftpUrls = [];   // To store FTP URLs

            for (const [index, fileObj] of files.entries()) {
                try {
                    // Validate fileObj and Base64 string
                    if (!fileObj || typeof fileObj.file_data !== 'string') {
                        throw new Error(`Invalid file object at index ${index + 1}. Expected a 'file_data' string.`);
                    }

                    const fileBase64 = fileObj.file_data;
                    const match = fileBase64.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
                    if (!match) {
                        throw new Error(`Invalid Base64 format for file ${index + 1}`);
                    }

                    const fileType = match[1];
                    const fileData = match[2];
                    const buffer = Buffer.from(fileData, 'base64');

                    // Generate unique file name
                    const now = new Date();
                    const dateTime = now.toISOString().slice(0, 19).replace(/[:.-]/g, '_');
                    const fileName = `${sanitizedRegId}_${dateTime}_${index + 1}.${fileType}`;
                    const filePath = path.join(uploadDir, fileName);

                    // Write the file locally
                    fs.writeFileSync(filePath, buffer);
                    logger.info(`Saved file: ${fileName} for reg_id: ${reg_id}`);
                    filePaths.push(filePath);

                    // Upload file to FTP
                    const ftpClient = new ftp.Client();
                    ftpClient.ftp.verbose = true;

                    const ftpDetails = await getFtpDetails();
                    await ftpClient.access({
                        host: ftpDetails.FTPServer,
                        port: parseInt(ftpDetails.FTPPort, 10),
                        user: ftpDetails.FTPUser,
                        password: ftpDetails.FTPPassword,
                        secure: false,
                    });

                    const remoteFolderPath = `/ifca-att/FAAssetUpload/AssetPicture/`;
                    await ftpClient.ensureDir(remoteFolderPath);
                    logger.info(`Ensured folder exists: ${remoteFolderPath}`);

                    const remoteFilePath = `${remoteFolderPath}${fileName}`;
                    await ftpClient.uploadFrom(filePath, remoteFilePath);
                    logger.info(`File uploaded to FTP: ${remoteFilePath}`);

                    ftpUrls.push(`${ftpDetails.qrview}${remoteFolderPath}${fileName}`);

                    // Clean up local file
                    fs.unlinkSync(filePath);
                    logger.info(`Temporary file deleted: ${fileName}`);

                    ftpClient.close();
                } catch (error) {
                    if (error instanceof Error) {
                        logger.error(`Error processing file at index ${index + 1} for reg_id: ${reg_id}. Error: ${error.message}`);
                        res.status(400).json({
                            success: false,
                            message: error.message,
                            reg_id,
                        });
                    } else {
                        logger.error(`Error processing file at index ${index + 1} for reg_id: ${reg_id}. Unknown error occurred.`);
                        res.status(400).json({
                            success: false,
                            message: "An unknown error occurred.",
                            reg_id,
                        });
                    }
                    return;
                }
            }

            // Call checkAndUpdateAsset function to update the database with the files' information
            try {
                await checkAndUpdate(entity_cd, reg_id, status_review, location_map, ftpUrls);

                const fassetTrxUpdates = {
                    new_status_review: status_review || null,
                    note: notes || null,
                    new_location_map: location_map || null,
                    audit_status: audit_status || null,
                    ftpUrlupdate: ftpUrls.length > 0 ? ftpUrls : null, // Ensure ftpUrlupdateNew is null if no URLs are present
                };

                await UpdatetoFassetTrx(entity_cd, reg_id, fassetTrxUpdates);
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
                return;
            }
            
        }

        res.status(200).json({
            success: true,
            message: "Assets updated successfully",
        });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";

        logger.error(`Failed to update assets: ${errorMessage}`);

        res.status(500).json({
            success: false,
            message: "Failed to update assets",
            error: errorMessage,
            stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined,
        });
    }
};