import { poolPromise } from '../lib/db';
import { Request, Response } from "express";
import * as sql from 'mssql';
import { DataItem } from '../types/QrCodeTypes';

export const GetDatanonQr = async () => {
    try {
        const pool = await poolPromise;  // Get the pool
        const result = await pool.request().query(`
            SELECT * FROM mgr.v_fa_fasset_qrdata WHERE qr_url_attachment IS NULL OR qr_url_attachment = ''
        `);
        return result.recordset;
    } catch (error) {
        console.error("Error fetching data", error);
        throw error;
    }
};

export const GetDataWithQr = async () => {
    try {
        const pool = await poolPromise;  // Get the pool
        const result = await pool.request().query(`
            SELECT * FROM mgr.v_fa_fasset_qrdata WHERE qr_url_attachment IS NOT NULL AND qr_url_attachment <> ''
        `);
        return result.recordset;
    } catch (error) {
        console.error("Error fetching data", error);
        throw error;
    }
};

export const GetDataWhere = async (data: DataItem[]) => {
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
        console.error("Error fetching data", error);
        throw error;  // Rethrow the error to be handled in the controller
    }
}

export const UpdateDataPrint = async (data: DataItem[]) => {
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
        console.error("Error updating data", error);
        throw error;  // Rethrow the error to be handled in the controller
    }
}

export const DataQRSaving = async (data: DataItem[]) => {
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
        console.error("Error Inserting data", error);
        throw error;  // Rethrow the error to be handled in the controller
    }
}

export const GetDataWhereTrx = async (data: DataItem[]) => {
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
        console.error("Error fetching data", error);
        throw error;  // Rethrow the error to be handled in the controller
    }
}