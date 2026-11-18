# GAS API Reference — v2.0.0

All calls are routed through `doGet` with JSONP parameters `action`, `payload`, `callback`, and optional `key`.

| Action | Payload | Purpose |
|---|---|---|
| health | `{}` | ตรวจสถานะ/เวอร์ชัน |
| dashboard | `{}` | สรุปจำนวนรายการ |
| getProfile / saveProfile | `profile` | โปรไฟล์หน่วยงาน |
| listDocuments / getDocument / saveDocument / deleteDocument | `id`, `document` | เอกสาร |
| listModule | `module`, `filters` | อ่านทะเบียน/งาน |
| saveModule | `module`, `record` | เพิ่ม/แก้ไขรายการ |
| deleteModule | `module`, `id` | ลบรายการ |
| nextDocumentNumber | `kind`, `year` | จองเลขลำดับ |
| listAudit | `limit` | ประวัติการใช้งาน |
| assetStart / assetChunk / assetFinish | image metadata/chunk | เก็บภาพตราในชีต Assets |

Supported modules: `incoming`, `outgoing`, `tasks`, `workflows`, `users`, `notifications`, `settings`, `sequences`.

Generic module records are stored as JSON in the module's `dataJson` column. The API is a functional prototype; JSONP GET is not an appropriate transport for confidential records or production authentication.
