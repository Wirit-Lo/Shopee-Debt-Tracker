# Shopee Debt Tracker

เว็บสำหรับจดและคำนวณยอดผ่อน Shopee แบบง่าย ๆ

## ใช้งานในเครื่อง

เปิดผ่าน local server:

```bash
python3 -m http.server 5173
```

แล้วเข้า:

```text
http://localhost:5173
```

## การเก็บข้อมูลตอนนี้

เวอร์ชันแรกเก็บข้อมูลใน `localStorage` ของ browser ภายใต้ key:

```text
shopeeDebtTracker.items
```

ถ้าเปลี่ยน browser, เปลี่ยน domain/port, หรือล้าง site data ข้อมูลจะไม่ตามไปด้วย

ในหน้าเว็บมีปุ่ม `สำรองข้อมูล` เพื่อ export เป็นไฟล์ JSON และ `นำเข้าข้อมูล` เพื่อ restore กลับมาได้

## Deploy บน Render

เริ่มแบบง่ายสุดด้วย Static Site:

- Build Command: เว้นว่าง
- Publish Directory: `.`

ถ้าต้องการเก็บข้อมูลข้ามเครื่องในเฟสถัดไป แนะนำเพิ่ม backend API และใช้ PostgreSQL
