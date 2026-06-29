# Shopee Debt Tracker

เว็บสำหรับจดและคำนวณยอดผ่อน Shopee แบบง่าย ๆ

## ใช้งานในเครื่อง

ติดตั้ง dependency แล้วรันเว็บ:

```bash
npm install
npm start
```

แล้วเข้า:

```text
http://localhost:3000
```

## การเก็บข้อมูลตอนนี้

บน Render ข้อมูลจะเก็บใน PostgreSQL ผ่าน API กลาง ทำให้เปิดจากคอมหรือมือถือแล้วเห็นข้อมูลชุดเดียวกัน

ถ้าเปิดในเครื่องโดยยังไม่ได้ตั้ง `DATABASE_URL` เว็บจะ fallback ไปเก็บใน `localStorage` ของ browser และมีปุ่ม `สำรองข้อมูล` / `นำเข้าข้อมูล` เป็น JSON

## Deploy บน Render

ใช้ Blueprint จากไฟล์ `render.yaml` ใน repo ได้เลย โดย Render จะสร้าง Web Service และ PostgreSQL ให้
