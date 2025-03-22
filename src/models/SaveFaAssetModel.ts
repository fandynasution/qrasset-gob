import { poolPromise } from '../lib/db';
import * as sql from 'mssql';
import fs from 'fs';
import path from 'path';
import multer from "multer";
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

export const checkAndUpdateAsset = async (
    entity_cd: string,
    reg_id: string,
    updates: { [key: string]: string | number | null }
) => {
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
        const pool = await poolPromise;

        // Pisahkan URL berdasarkan `;`
        let urls = typeof updates.url_file_attachment === 'string'
            ? updates.url_file_attachment.split(';')
            : [];

        // Siapkan query UPDATE tanpa pengecekan kesamaan data
        const request = pool.request();
        request.input('entity_cd', sql.VarChar, entity_cd);
        request.input('reg_id', sql.VarChar, reg_id);
        request.input('url_file_attachment', sql.VarChar, urls[0] || null);
        request.input('url_file_attachment2', sql.VarChar, urls[1] || null);
        request.input('url_file_attachment3', sql.VarChar, urls[2] || null);

        for (const [key, value] of Object.entries(updates)) {
            if (key !== 'url_file_attachment') { // Jangan input dua kali
                const type = typeof value === 'number' ? sql.Int : sql.VarChar;
                request.input(key, type, value);
            }
        }

        // Lakukan UPDATE tanpa pengecekan perbedaan
        await request.query(`
            UPDATE mgr.fa_fasset
            SET 
                url_file_attachment = @url_file_attachment,
                url_file_attachment2 = @url_file_attachment2,
                url_file_attachment3 = @url_file_attachment3,
                ${Object.keys(updates)
                    .filter(key => key !== 'url_file_attachment')
                    .map(key => `${key} = @${key}`)
                    .join(', ')}
            WHERE entity_cd = @entity_cd AND reg_id = @reg_id
        `);

        logger.info(`Data updated in fa_fasset for entity_cd: ${entity_cd}, reg_id: ${reg_id}`);

    } catch (error) {
        logger.error("Error syncing data to fa_fasset:", error);
        throw error;
    }
};

export const syncToFassetTrx = async (
    entity_cd: string,
    reg_id: string,
    updates: { [key: string]: any }
) => {
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
        const pool = await poolPromise;
        
        // Function to split and return the URL parts
        const getFileAttachments = (urlStr: string) => {
            if (!urlStr) return [null, null, null];
            const urls = urlStr.split(';').map(url => url.trim());
            return [
                urls[0] || null, 
                urls[1] || null, 
                urls[2] || null
            ];
        };

        // Query untuk cek apakah data sudah ada
        const existingDataResult = await pool.request()
            .input('entity_cd', sql.VarChar, entity_cd)
            .input('reg_id', sql.VarChar, reg_id)
            .query(`
                SELECT TOP 1 new_location_map, new_status_review, note, audit_status, url_file_attachment, url_file_attachment2, url_file_attachment3
                FROM mgr.fa_fasset_trx
                WHERE entity_cd = @entity_cd AND reg_id = @reg_id
                ORDER BY trx_date DESC
            `);

        const existingData = existingDataResult.recordset[0];

        const [newUrlFileAttachment, newUrlFileAttachment2, newUrlFileAttachment3] = getFileAttachments(updates.url_file_attachment);

        if (existingDataResult.recordset.length === 0) {
            // Jika data belum ada, lakukan insert langsung
            await pool.request()
                .input('entity_cd', sql.VarChar, entity_cd)
                .input('reg_id', sql.VarChar, reg_id)
                .input('new_location_map', sql.VarChar, updates.new_location_map || null)
                .input('new_status_review', sql.VarChar, updates.new_status_review || null)
                .input('note', sql.VarChar, updates.note || null)
                .input('audit_status', sql.VarChar, updates.audit_status || null)
                .input('url_file_attachment', sql.VarChar, newUrlFileAttachment)
                .input('url_file_attachment2', sql.VarChar, newUrlFileAttachment2)
                .input('url_file_attachment3', sql.VarChar, newUrlFileAttachment3)
                .query(`
                    INSERT INTO mgr.fa_fasset_trx 
                    (entity_cd, reg_id, trx_date, old_location_map, new_location_map, old_status_review, new_status_review, note, audit_status, audit_user, audit_date, 
                    url_file_attachment, url_file_attachment2, url_file_attachment3, staff_id, staff_name)
                    VALUES 
                    (@entity_cd, @reg_id, GETDATE(), null, @new_location_map, null, @new_status_review, @note, @audit_status, 'WEBAPI', GETDATE(),
                    @url_file_attachment, @url_file_attachment2, @url_file_attachment3, (SELECT staff_id FROM mgr.fa_fasset WHERE entity_cd = @entity_cd AND reg_id = @reg_id), 
                    (SELECT staff_name FROM mgr.cf_staff WHERE staff_id = (SELECT staff_id FROM mgr.fa_fasset WHERE entity_cd = @entity_cd AND reg_id = @reg_id)))
                `);
        } else {
            // Optimasi: Gunakan nilai existingData jika updates bernilai null
            const newLocationMap = updates.new_location_map ?? existingData.new_location_map;
            const newStatusReview = updates.new_status_review ?? existingData.new_status_review;
            const note = updates.note ?? existingData.note ?? 'No Note';
            const auditStatus = updates.audit_status ?? existingData.audit_status ?? 'N';

            // Cek apakah data berbeda
            await pool.request()
                .input('entity_cd', sql.VarChar, entity_cd)
                .input('reg_id', sql.VarChar, reg_id)
                .input('new_location_map', sql.VarChar, newLocationMap)
                .input('old_location_map', sql.VarChar, existingData.new_location_map)
                .input('new_status_review', sql.VarChar, newStatusReview)
                .input('old_status_review', sql.VarChar, existingData.new_status_review)
                .input('note', sql.VarChar, note)
                .input('audit_status', sql.VarChar, auditStatus)
                .input('url_file_attachment', sql.VarChar, newUrlFileAttachment)
                .input('url_file_attachment2', sql.VarChar, newUrlFileAttachment2)
                .input('url_file_attachment3', sql.VarChar, newUrlFileAttachment3)
                .query(`
                    INSERT INTO mgr.fa_fasset_trx 
                    (entity_cd, reg_id, trx_date, old_location_map, new_location_map, old_status_review, new_status_review, note, audit_status, audit_user, audit_date, 
                    url_file_attachment, url_file_attachment2, url_file_attachment3, staff_id, staff_name)
                    VALUES 
                    (@entity_cd, @reg_id, GETDATE(), @old_location_map, @new_location_map, @old_status_review, @new_status_review, @note, @audit_status, 'WEBAPI', GETDATE(),
                    @url_file_attachment, @url_file_attachment2, @url_file_attachment3, (SELECT staff_id FROM mgr.fa_fasset WHERE entity_cd = @entity_cd AND reg_id = @reg_id), 
                    (SELECT staff_name FROM mgr.cf_staff WHERE staff_id = (SELECT staff_id FROM mgr.fa_fasset WHERE entity_cd = @entity_cd AND reg_id = @reg_id)))
                `);

            // Update jika ada perbedaan untuk note atau audit_status
            if (existingData.note !== note) {
                await pool.request()
                    .input('entity_cd', sql.VarChar, entity_cd)
                    .input('reg_id', sql.VarChar, reg_id)
                    .input('note', sql.VarChar, note)
                    .query(`
                        UPDATE mgr.fa_fasset_trx
                        SET note = @note,
                        staff_id = (SELECT staff_id FROM mgr.fa_fasset WHERE entity_cd = @entity_cd AND reg_id = @reg_id),
                        staff_name = (SELECT staff_name FROM mgr.cf_staff WHERE staff_id = (SELECT staff_id FROM mgr.fa_fasset WHERE entity_cd = @entity_cd AND reg_id = @reg_id)))
                        WHERE entity_cd = @entity_cd 
                        AND reg_id = @reg_id
                        AND trx_date = (
                            SELECT MAX(trx_date)
                            FROM mgr.fa_fasset_trx
                            WHERE entity_cd = @entity_cd 
                                AND reg_id = @reg_id
                        );
                    `);
            }

            if (existingData.audit_status !== auditStatus) {
                await pool.request()
                    .input('entity_cd', sql.VarChar, entity_cd)
                    .input('reg_id', sql.VarChar, reg_id)
                    .input('audit_status', sql.VarChar, auditStatus)
                    .query(`
                        UPDATE mgr.fa_fasset_trx
                        SET 
                        audit_status = @audit_status,
                        staff_id = (SELECT staff_id FROM mgr.fa_fasset WHERE entity_cd = @entity_cd AND reg_id = @reg_id),
                        staff_name = (SELECT staff_name FROM mgr.cf_staff WHERE staff_id = (SELECT staff_id FROM mgr.fa_fasset WHERE entity_cd = @entity_cd AND reg_id = @reg_id)))
                        WHERE entity_cd = @entity_cd 
                        AND reg_id = @reg_id
                        AND trx_date = (
                            SELECT MAX(trx_date)
                            FROM mgr.fa_fasset_trx
                            WHERE entity_cd = @entity_cd 
                                AND reg_id = @reg_id
                        );
                    `);
            }
        }
    } catch (error) {
        logger.error('Error syncing data to fa_fasset_trx:', error);
        throw error;
    }
};
