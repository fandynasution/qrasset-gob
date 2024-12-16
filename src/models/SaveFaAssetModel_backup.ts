import { poolPromise } from '../lib/db';
import * as sql from 'mssql';

export const checkAndUpdateAsset = async (
    entity_cd: string,
    reg_id: string,
    updates: { [key: string]: string | number | null }
) => {
    try {
        const pool = await poolPromise; // Get the pool

        const existingDataResult = await pool.request()
            .input('entity_cd', sql.VarChar, entity_cd)
            .input('reg_id', sql.VarChar, reg_id)
            .query(`
                SELECT url_file_attachment, location_map, status_review
                FROM mgr.fa_fasset
                WHERE entity_cd = @entity_cd AND reg_id = @reg_id
            `);
        
        const existingData = existingDataResult.recordset[0];

        if (existingData) {
            let isDifferent = false;
            const updateFields = [];
            for (const [key, value] of Object.entries(updates)) {
                if (existingData[key] !== value) {
                    isDifferent = true;
                    updateFields.push(`${key} = @${key}`);
                }
            }
            if (isDifferent) {
                // Ada perbedaan, lakukan UPDATE
                const setClause = updateFields.join(', ');
                const request = pool.request();
                request.input('entity_cd', sql.VarChar, entity_cd);
                request.input('reg_id', sql.VarChar, reg_id);
                for (const [key, value] of Object.entries(updates)) {
                    const type = typeof value === 'number' ? sql.Int : sql.VarChar;
                    request.input(key, type, value);
                }

                await request.query(`
                    UPDATE mgr.fa_fasset
                    SET ${setClause}
                    WHERE entity_cd = @entity_cd AND reg_id = @reg_id
                `);
                console.log(`Data updated in fa_fasset for entity_cd: ${entity_cd}, reg_id: ${reg_id}`);
            } else {
                console.log(`No changes for entity_cd: ${entity_cd}, reg_id: ${reg_id}. Data is identical.`);
            }
        }
    } catch (error) {
        console.error("Error syncing data to fa_fasset:", error);
        throw error;
    }
};

export const syncToFassetTrx = async (
    entity_cd: string,
    reg_id: string,
    updates: { [key: string]: any }
) => {
    try {
        const pool = await poolPromise;

        // Query untuk cek apakah data sudah ada, urutkan berdasarkan trx_date terbaru
        const existingDataResult = await pool.request()
            .input('entity_cd', sql.VarChar, entity_cd)
            .input('reg_id', sql.VarChar, reg_id)
            .query(`
                SELECT TOP 1 new_location_map, new_status_review, note, audit_status
                FROM mgr.fa_fasset_trx
                WHERE entity_cd = @entity_cd AND reg_id = @reg_id
                ORDER BY trx_date DESC
            `);
        const existingData = existingDataResult.recordset[0];
        // console.log(existingData.new_location_map);
        if (existingDataResult.recordset.length === 0) {
            await pool.request()
                .input('entity_cd', sql.VarChar, entity_cd)
                .input('reg_id', sql.VarChar, reg_id)
                .input('new_location_map', sql.VarChar, updates.new_location_map)
                .input('new_status_review', sql.VarChar, updates.new_status_review)
                .input('note', sql.VarChar, updates.note)
                .input('audit_status', sql.VarChar, updates.audit_status)
                .query(`
                    INSERT INTO mgr.fa_fasset_trx 
                    (entity_cd, reg_id, trx_date, old_location_map, new_location_map, old_status_review, new_status_review, note, audit_status, audit_user, audit_date)
                    VALUES 
                    (@entity_cd, @reg_id, GETDATE(), null, @new_location_map, null, @new_status_review, @note, @audit_status, 'WEBAPI', getdate())
                `);
        } else {
            const existingData = existingDataResult.recordset[0];
            if (existingData.new_location_map !== updates.new_location_map && 
                existingData.new_status_review !== updates.new_status_review
            ) {
                const existingDataResult1 = await pool.request()
                    .input('entity_cd', sql.VarChar, entity_cd)
                    .input('reg_id', sql.VarChar, reg_id)
                    .query(`
                        SELECT TOP 1 new_location_map, old_status_review, old_location_map, new_status_review
                        FROM mgr.fa_fasset_trx
                        WHERE entity_cd = @entity_cd AND reg_id = @reg_id
                        ORDER BY trx_date DESC
                    `);
                const GetData1 = existingDataResult1.recordset[0];
                await pool.request()
                    .input('entity_cd', sql.VarChar, entity_cd)
                    .input('reg_id', sql.VarChar, reg_id)
                    .input('new_location_map', sql.VarChar, updates.new_location_map)
                    .input('old_location_map', sql.VarChar, GetData1.new_location_map)
                    .input('new_status_review', sql.VarChar, updates.new_status_review)
                    .input('old_status_review', sql.VarChar, GetData1.new_status_review)
                    .input('note', sql.VarChar, updates.note)
                    .input('audit_status', sql.VarChar, updates.audit_status)
                    .query(`
                        INSERT INTO mgr.fa_fasset_trx 
                        (entity_cd, reg_id, trx_date, old_location_map, new_location_map, old_status_review, new_status_review, note, audit_status, audit_user, audit_date)
                        VALUES 
                        (@entity_cd, @reg_id, GETDATE(), @old_location_map, @new_location_map, @old_status_review, @new_status_review, @note, @audit_status, 'WEBAPI', getdate())
                    `);
            } else if (existingData.new_status_review !== updates.new_status_review && updates.new_status_review != null
            ) {
                const existingDataResult2 = await pool.request()
                    .input('entity_cd', sql.VarChar, entity_cd)
                    .input('reg_id', sql.VarChar, reg_id)
                    .query(`
                        SELECT TOP 1 new_location_map, old_status_review, old_location_map, new_status_review
                        FROM mgr.fa_fasset_trx
                        WHERE entity_cd = @entity_cd AND reg_id = @reg_id
                        ORDER BY trx_date DESC
                    `);
                const GetData2 = existingDataResult2.recordset[0];
                await pool.request()
                    .input('entity_cd', sql.VarChar, entity_cd)
                    .input('reg_id', sql.VarChar, reg_id)
                    .input('new_location_map', sql.VarChar, GetData2.new_location_map)
                    .input('old_location_map', sql.VarChar, GetData2.old_location_map)
                    .input('new_status_review', sql.VarChar, updates.new_status_review)
                    .input('old_status_review', sql.VarChar, GetData2.new_status_review)
                    .input('note', sql.VarChar, updates.note)
                    .input('audit_status', sql.VarChar, updates.audit_status)
                    .query(`
                        INSERT INTO mgr.fa_fasset_trx 
                        (entity_cd, reg_id, trx_date, old_location_map, new_location_map, old_status_review, new_status_review, note, audit_status, audit_user, audit_date)
                        VALUES 
                        (@entity_cd, @reg_id, GETDATE(), @old_location_map, @new_location_map, @old_status_review, @new_status_review, @note, @audit_status, 'WEBAPI', getdate())
                    `);
            } else if (existingData.new_location_map !== updates.new_location_map && updates.new_location_map != null
            ) {
                const existingDataResult3 = await pool.request()
                    .input('entity_cd', sql.VarChar, entity_cd)
                    .input('reg_id', sql.VarChar, reg_id)
                    .query(`
                        SELECT TOP 1 new_location_map, old_status_review, old_location_map, new_status_review
                        FROM mgr.fa_fasset_trx
                        WHERE entity_cd = @entity_cd AND reg_id = @reg_id
                        ORDER BY trx_date DESC
                    `);
                const GetData3 = existingDataResult3.recordset[0];
                await pool.request()
                    .input('entity_cd', sql.VarChar, entity_cd)
                    .input('reg_id', sql.VarChar, reg_id)
                    .input('new_location_map', sql.VarChar, updates.new_location_map)
                    .input('old_location_map', sql.VarChar, GetData3.new_location_map)
                    .input('new_status_review', sql.VarChar, GetData3.new_status_review)
                    .input('old_status_review', sql.VarChar, GetData3.old_status_review)
                    .input('note', sql.VarChar, updates.note)
                    .input('audit_status', sql.VarChar, updates.audit_status)
                    .query(`
                        INSERT INTO mgr.fa_fasset_trx 
                        (entity_cd, reg_id, trx_date, old_location_map, new_location_map, old_status_review, new_status_review, note, audit_status, audit_user, audit_date)
                        VALUES 
                        (@entity_cd, @reg_id, GETDATE(), @old_location_map, @new_location_map, @old_status_review, @new_status_review, @note, @audit_status, 'WEBAPI', getdate())
                    `);
            }

            if (existingData.note !== updates.note && updates.note != null) {
                await pool
                    .request()
                    .input('entity_cd', sql.VarChar, entity_cd)
                    .input('reg_id', sql.VarChar, reg_id)
                    .input('note', sql.VarChar, updates.note)
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
            if (existingData.audit_status !== updates.audit_status  && updates.audit_status != null) {
                await pool
                    .request()
                    .input('entity_cd', sql.VarChar, entity_cd)
                    .input('reg_id', sql.VarChar, reg_id)
                    .input('audit_status', sql.VarChar, updates.audit_status)
                    .query(`
                        UPDATE mgr.fa_fasset_trx
                        SET  audit_status = @audit_status
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
        console.error('Error syncing data to fa_fasset_trx:', error);
        throw error;
    }
};
