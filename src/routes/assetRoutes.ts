import express from 'express';
import { generateAndSaveQrCode, generateOneQrCode } from '../controllers/QrCodeController';
import { DatanonQr, DatawithQr, DataWhere, DataUpdatePrint, DataWhereTrx } from '../controllers/FaAssetController';
import { UpdateAsset } from '../controllers/SaveFaAssetController';

const router = express.Router();

router.get("/generate", generateAndSaveQrCode);
router.post("/generateqr", generateOneQrCode);
router.get("/datanonqr", DatanonQr);
router.get("/datawithqr", DatawithQr);
router.put('/update-print', DataUpdatePrint);

router.post("/get-asset", DataWhere);
router.post("/get-asset-trx", DataWhereTrx);
/**
 * @swagger
 * /api/get-asset:
 *   post:
 *     summary: Select QR Asset with specified parameter
 *     description: Run this URL to View QR Asset with specified parameter
 *     tags: [For QR Code Power Apps]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: object
 *               properties:
 *                 entity_cd:
 *                   type: string
 *                 reg_id:
 *                   type: string
 *               example:
 *                 entity_cd: "01"
 *                 reg_id: "006/EQP2/BTID/VI/12"
 *     responses:
 *       200:
 *         description: Successful Select Data 
 *       404:
 *         description: No Data on DB
 *       500:
 *         description: Error Connection to DB
 */

router.put('/update-asset', UpdateAsset);
/**
 * @swagger
 * /api/update-asset:
 *   put:
 *     summary: Update QR Asset with specified parameters
 *     description: Update QR Asset data by providing necessary parameters including location coordinates.
 *     tags: [For QR Code Power Apps]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               entity_cd:
 *                 type: string
 *                 description: Entity code identifier
 *               reg_id:
 *                 type: string
 *                 description: Registration ID of the asset
 *               location_map:
 *                 type: string
 *                 description: Geographical coordinates (latitude and longitude)
 *               status_review:
 *                 type: string
 *                 description: Status review identifier
 *               notes:
 *                 type: string
 *                 description: Additional notes about the asset
 *               audit_status:
 *                 type: string
 *                 description: Indicates if the asset has been audited ("Y" or "N")
 *               files:
 *                 type: array
 *                 description: List of image files in base64 encoding
 *                 items:
 *                   type: object
 *                   properties:
 *                     file_data:
 *                       type: string
 *                       description: Base64 encoded image data.
 *                       example: |
 *                         data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAR4AAACw
 *                         CAMAAADudvHOAAAAw1BMVEX///8...
 *                 example:
 *                   - file_data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAR4AAACw\nCAMAAADudvHOAAAAw1BMVEX///8..."
 *                   - file_data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAR4AAACw\nCAMAAADudvHOAAAAw1BMVEX///8..."
 *                   - file_data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAR4AAACw\nCAMAAADudvHOAAAAw1BMVEX///8..."
 *     responses:
 *       200:
 *         description: Successful update of asset data
 *       400:
 *         description: Bad Request, Invalid Parameter
 *       500:
 *         description: Error connecting to the database
 */
export default router;