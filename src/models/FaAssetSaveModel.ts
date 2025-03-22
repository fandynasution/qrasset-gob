import { poolPromise } from '../lib/db';
import * as sql from 'mssql';
import fs from 'fs';
import path from 'path';
import multer from "multer";
import * as ftp from 'basic-ftp';
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

// Fungsi untuk memperbarui data asset di database
export const checkAndUpdate = async (
    entity_cd: string,
    reg_id: string,
    status_review: string,
    location_map: string,
    files: string[]
) => {
    try {
        const pool = await poolPromise; // Mendapatkan koneksi pool ke database
        // Mengambil data yang sudah ada di tabel
        const existingDataResult = await pool.request()
            .input('entity_cd', sql.VarChar, entity_cd)
            .input('reg_id', sql.VarChar, reg_id)
            .query(`
                SELECT url_file_attachment, url_file_attachment2, url_file_attachment3, location_map, status_review
                FROM mgr.fa_fasset
                WHERE entity_cd = @entity_cd AND reg_id = @reg_id
            `);
        logger.error(files[0]);
        const existingData = existingDataResult.recordset[0];
        if (existingData) {
            let updates: { [key: string]: string | null } = {};
            // Kondisi untuk 3 file
            if (files.length === 3) {
                updates['url_file_attachment2'] = files[0];
                updates['url_file_attachment3'] = files[1];
                updates['url_file_attachment'] = files[2];
            }
            // Kondisi untuk 2 file
            else if (files.length === 2) {
                updates['url_file_attachment2'] = files[0];
                updates['url_file_attachment3'] = files[1];
                // Jika file 2 sudah ada di url_file_attachment3, jangan diupdate
                if (!existingData.url_file_attachment3) {
                    updates['url_file_attachment'] = null;
                }
            }
            // Kondisi untuk 1 file
            else if (files.length === 1) {
                updates['url_file_attachment2'] = files[0];
                // Jika url_file_attachment2 atau url_file_attachment3 sudah ada data, biarkan tetap
                if (!existingData.url_file_attachment2) {
                    updates['url_file_attachment3'] = null;
                }
                if (!existingData.url_file_attachment3) {
                    updates['url_file_attachment'] = null;
                }
            }

            // Jika ada perubahan, lakukan pembaruan
            if (Object.keys(updates).length > 0) {
                await update(entity_cd, reg_id, status_review, location_map, updates);
            }
        }
    } catch (error) {
        logger.error("Error syncing data to fa_fasset:", error);
        throw error;
    }
};

// Fungsi untuk melakukan update pada tabel mgr.fa_fasset
const update = async (entity_cd: string, reg_id: string, status_review: string, location_map: string, updates: { [key: string]: string | null }) => {
    try {
        const pool = await poolPromise; // Mendapatkan koneksi pool ke database
        let updateFields: string[] = [];
        
        // Menyusun klausa UPDATE
        // Selalu tambahkan kolom 'url_file_attachment2' dan 'url_file_attachment3' meskipun nilainya null
        const mandatoryFields = ['url_file_attachment', 'url_file_attachment2', 'url_file_attachment3'];
    
        // Pastikan ketiga kolom selalu ada dalam klausa UPDATE
        for (const field of mandatoryFields) {
            const value = updates[field] ?? null; // Jika null, tetapkan null
            if (value !== null) {
                updateFields.push(`${field} = @${field}`);
            } else {
                updateFields.push(`${field} = @${field}`); // Tetap masukkan kolom dengan null
            }
        }

         // Tambahkan kolom status_review dan location_map
        updateFields.push('status_review = @status_review');
        updateFields.push('location_map = @location_map');
    
        const setClause = updateFields.join(', ');
        const request = pool.request();
        request.input('entity_cd', sql.VarChar, entity_cd);
        request.input('reg_id', sql.VarChar, reg_id);
    
        // Menambahkan parameter untuk setiap field yang diperbarui (termasuk null)
        for (const field of mandatoryFields) {
            const value = updates[field] ?? null; // Pastikan jika null, gunakan null
            request.input(field, sql.VarChar, value); // Gunakan sql.VarChar untuk null atau string
        }
        
        // Tambahkan parameter untuk status_review dan location_map
        request.input('status_review', sql.VarChar, status_review);
        request.input('location_map', sql.VarChar, location_map);
    
        await request.query(`
            UPDATE mgr.fa_fasset
            SET ${setClause}
            WHERE entity_cd = @entity_cd AND reg_id = @reg_id
        `);
    
        logger.error(`Data updated in fa_fasset for entity_cd: ${entity_cd}, reg_id: ${reg_id}`);
    } catch (error) {
        logger.error("Error updating asset:", error);
        throw error;
    }
};

export const UpdatetoFassetTrx = async (
    entity_cd: string,
    reg_id: string,
    updates: { [key: string]: any }
) => {
    try {
        const pool = await poolPromise;

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

        // Menyiapkan URL file attachment
        const ftpUrls = updates.ftpUrlupdate || [];
        const url_file_attachment = ftpUrls[0] || null;
        const url_file_attachment2 = ftpUrls[1] || null;
        const url_file_attachment3 = ftpUrls[2] || null;
        if (existingDataResult.recordset.length === 0) {
            // Jika data belum ada, lakukan insert langsung
            await pool.request()
                .input('entity_cd', sql.VarChar, entity_cd)
                .input('reg_id', sql.VarChar, reg_id)
                .input('new_location_map', sql.VarChar, updates.new_location_map || null)
                .input('new_status_review', sql.VarChar, updates.new_status_review || null)
                .input('note', sql.VarChar, updates.note || null)
                .input('audit_status', sql.VarChar, updates.audit_status || null)
                .input('url_file_attachment', sql.VarChar, url_file_attachment)
                .input('url_file_attachment2', sql.VarChar, url_file_attachment2)
                .input('url_file_attachment3', sql.VarChar, url_file_attachment3)
                .query(`
                    INSERT INTO mgr.fa_fasset_trx 
                    (entity_cd, reg_id, trx_date, old_location_map, new_location_map, old_status_review, new_status_review, note, audit_status, audit_user, audit_date, url_file_attachment, url_file_attachment2, url_file_attachment3)
                    VALUES 
                    (@entity_cd, @reg_id, GETDATE(), null, @new_location_map, null, @new_status_review, @note, @audit_status, 'WEBAPI', GETDATE(), @url_file_attachment, @url_file_attachment2, @url_file_attachment3)
                `);
        } else {
            // Optimasi: Gunakan nilai existingData jika updates bernilai null
            const newLocationMap = updates.new_location_map ?? existingData.new_location_map;
            const newStatusReview = updates.new_status_review ?? existingData.new_status_review;
            const note = updates.note ?? existingData.note ?? 'No Note';
            const auditStatus = updates.audit_status ?? existingData.audit_status ?? 'N';
            const newurlFileAttachment = updates.url_file_attachment ?? existingData.url_file_attachment;

            // Cek apakah data berbeda
            if (
                existingData.new_location_map !== newLocationMap ||
                existingData.new_status_review !== newStatusReview || existingData.url_file_attachment
            ) {
                await pool.request()
                    .input('entity_cd', sql.VarChar, entity_cd)
                    .input('reg_id', sql.VarChar, reg_id)
                    .input('new_location_map', sql.VarChar, newLocationMap)
                    .input('old_location_map', sql.VarChar, existingData.new_location_map)
                    .input('new_status_review', sql.VarChar, newStatusReview)
                    .input('old_status_review', sql.VarChar, existingData.new_status_review)
                    .input('note', sql.VarChar, note)
                    .input('audit_status', sql.VarChar, auditStatus)
                    .input('url_file_attachment', sql.VarChar, newurlFileAttachment)
                    .input('url_file_attachment2', sql.VarChar, url_file_attachment2)
                    .input('url_file_attachment3', sql.VarChar, url_file_attachment3)
                    .query(`
                        INSERT INTO mgr.fa_fasset_trx 
                        (entity_cd, reg_id, trx_date, old_location_map, new_location_map, old_status_review, new_status_review, note, audit_status, audit_user, audit_date, url_file_attachment, url_file_attachment2, url_file_attachment3)
                        VALUES 
                        (@entity_cd, @reg_id, GETDATE(), @old_location_map, @new_location_map, @old_status_review, @new_status_review, @note, @audit_status, 'WEBAPI', GETDATE(), @url_file_attachment, @url_file_attachment2, @url_file_attachment3)
                    `);
            }

            // Update jika ada perbedaan untuk note atau audit_status
            if (existingData.note !== note) {
                await pool.request()
                    .input('entity_cd', sql.VarChar, entity_cd)
                    .input('reg_id', sql.VarChar, reg_id)
                    .input('note', sql.VarChar, note)
                    .query(`
                        UPDATE mgr.fa_fasset_trx
                        SET note = @note
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
                        SET audit_status = @audit_status
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
}