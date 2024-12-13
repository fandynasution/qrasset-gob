export interface DataItem {
    entity_cd: string;
    reg_id: string;
}

export interface QrCodeInsertData {
    entity_cd: string;
    reg_id: string;
    qr_url_attachment: string; // Path to the QR code PNG file
}

export interface DataAssetUpdate {
    entity_cd: string;
    reg_id: string;
    source_file_attachment: string;
    location_map: string;
    status_review: string;
    notes: string;
}
