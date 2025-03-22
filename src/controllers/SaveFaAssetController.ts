import { Request, Response } from "express";
import fs from 'fs';
import path from 'path';
import multer from "multer";
import * as ftp from 'basic-ftp';
import { createLogger, format, transports } from "winston";
import { 
    checkAndUpdateAsset, 
    syncToFassetTrx 
} from '../models/SaveFaAssetModel';
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

    const dataArray = Array.isArray(dataWhereD) ? dataWhereD : [dataWhereD];

    // Validate that each entry has the required fields
    const validateFields = (details: { entity_cd: string; reg_id: string; location_map: string; status_review: string, url_file_attachment: string;  }) => {
        const missingFields = [];
        if (!details.entity_cd) missingFields.push("entity_cd");
        if (!details.reg_id) missingFields.push("reg_id");
        if (!details.location_map) missingFields.push("location_map");
        if (!details.status_review) missingFields.push("status_review");
        if (!details.status_review) missingFields.push("notes");
        if (!details.url_file_attachment || details.url_file_attachment.length < 1) {
            missingFields.push("At least 1 file");
        } else if (details.url_file_attachment.length > 3) {
            missingFields.push("No more than 3 files allowed");
        }
        return missingFields;
    };

    // Check all entries in dataArray
    const invalidEntries = dataArray.map((detail, index) => {
        const missingFields = validateFields(detail);
        return { index, missingFields };
    }).filter(entry => entry.missingFields.length > 0);

    if (invalidEntries.length > 0) {
        const errorDetails = invalidEntries
            .map(entry => {
                const missingFields = entry.missingFields;
                if (missingFields.length === 1) {
                    return `${missingFields[0]} is required`;
                } else if (missingFields.length === 2) {
                    return `${missingFields.join(" & ")} are required`;
                } else {
                    const allExceptLast = missingFields.slice(0, -1).join(", ");
                    const lastField = missingFields[missingFields.length - 1];
                    return `${allExceptLast} & ${lastField} are required`;
                }
            })
            .join("; ");

        const errorMessage = `Update failed. ${errorDetails}`;
        
        logger.error(errorMessage);

        res.status(400).json({
            success: false,
            message: 'Validation failed',
            errorMessage
        });
    }
    try {
        for (const dataItem of dataArray) {
            const { entity_cd, reg_id, url_file_attachment, status_review, notes, location_map, audit_status } = dataItem;
        
            logger.info(`Processing data for entity_cd: ${entity_cd} and reg_id: ${reg_id}`);
            // let ftpUrl: string | null = null;
            let ftpUrls: string[] = []; // Gunakan array untuk menyimpan semua URL

            if (url_file_attachment && Array.isArray(url_file_attachment)) {
                try {
                    for (let i = 0; i < url_file_attachment.length; i++) {
                        const fileAttachment = url_file_attachment[i];
                        if (fileAttachment && fileAttachment.file_data) {
                            // Decode Base64
                            const base64Data = fileAttachment.file_data.replace(/^data:image\/\w+;base64,/, '');
                            
                            // Dapatkan ekstensi file
                            const fileExtension = fileAttachment.file_data.match(/\/(.*?)\;/)?.[1] || 'png';


                            const now = new Date();
                            const todayDate =  now.toISOString().slice(0, 16).replace(/[:.-]/g, '_');
                        
                            const sanitizedRegId = reg_id.replace(/[\\/]/g, '_');
                            const tempFileName = `Asset_${entity_cd}_${sanitizedRegId}_${todayDate}_${i}.${fileExtension}`;
                            const tempDir = path.join(__dirname, '../../storage/temppicture');

                            // Buat direktori jika belum ada
                            if (!fs.existsSync(tempDir)) {
                                fs.mkdirSync(tempDir, { recursive: true });
                                logger.info(`Directory created: ${tempDir}`);
                            }

                            const tempFilePath = path.join(tempDir, tempFileName);
                            fs.writeFileSync(tempFilePath, base64Data, { encoding: 'base64' });

                            // Upload ke FTP
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
                            
                            const remoteFilePath = `${remoteFolderPath}${tempFileName}`;
                            await ftpClient.uploadFrom(tempFilePath, remoteFilePath);

                            // Simpan URL dalam array
                            ftpUrls.push(`${ftpDetails.qrview}${remoteFilePath}`);

                            // Hapus file sementara
                            fs.unlinkSync(tempFilePath);
                            ftpClient.close();
                        } else {
                            logger.error(`file_data is undefined for attachment at index ${i}`);
                        }
                    }
                } catch (ftpError) {
                    logger.error(`FTP upload failed for entity_cd: ${entity_cd}, reg_id: ${reg_id}. Error: ${ftpError}`);
                    res.status(400).json({
                        success: false,
                        message: ftpError,
                        reg_id,
                    });
                }
            } else {
                logger.error('url_file_attachment is not an array or is undefined');
                res.status(400).json({
                    success: false,
                    message: 'url_file_attachment is not an array or is undefined',
                    reg_id,
                });
            }

            // Gabungkan URL dengan pemisah jika database hanya mendukung satu kolom string
            const ftpUrlString = ftpUrls.length > 0 ? ftpUrls.join(';') : null;

            // Data untuk diperbarui
            const fassetUpdates: { [key: string]: string | null } = {
                url_file_attachment: ftpUrlString, // Tetap null jika FTP gagal
                status_review: status_review || null,
                location_map: location_map || null,
            };
        
            // Panggil fungsi untuk menyimpan data
            await checkAndUpdateAsset(entity_cd, reg_id, fassetUpdates);
        
            // Data untuk tabel `mgr.fa_fasset_trx`
            const fassetTrxUpdates: { [key: string]: string | null } = {
                new_status_review: status_review || null,
                note: notes || null,
                new_location_map: location_map || null,
                audit_status: audit_status || null,
                url_file_attachment: ftpUrlString,
            };
            await syncToFassetTrx(entity_cd, reg_id, fassetTrxUpdates);
        
            logger.info(`Successfully updated data for entity_cd: ${entity_cd}, reg_id: ${reg_id}`);
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