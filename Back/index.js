import mysql from "mysql2";
import express from "express";
import cors from "cors";
import fs from "fs"; // Thư viện đọc file hệ thống để nạp chứng chỉ SSL

const app = express();

app.use(express.json());

// Sửa lại CORS: Cho phép cả môi trường test local và trang web tĩnh trên GitHub Pages truy cập
app.use(cors({
  origin: [
    'http://localhost:5173',                  // Khai thông cho React chạy thử dưới máy local
    'https://olivernam25.github.io'           // BẮT BUỘC: Khai thông cho giao diện GitHub Pages gọi sang
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

// Cấu hình kết nối tới Aiven Cloud sử dụng giao thức bảo mật SSL
const db = mysql.createConnection({
  host: "light-namoliver.h.aivencloud.com",
  port: 13303,
  user: "avnadmin",
  password: "AVNS_56MvEfCEu9lCTo2Jfqj", // Mật khẩu database Aiven
  database: "lightdata",       
  ssl: {
    ca: fs.readFileSync("./ca.pem"), // Đường dẫn đọc file chứng chỉ ca.pem nằm cùng thư mục
    rejectUnauthorized: true
  }
});

db.connect((err) => {
  if (err) {
    console.error("❌ Kết nối MySQL Aiven thất bại:", err.message);
    process.exit(1);
  }
  console.log("✅ Đã kết nối MySQL Aiven thành công!");
});

// GET: Lấy 20 bản ghi mới nhất từ Aiven Cloud để vẽ biểu đồ
app.get("/lux", (req, res) => {
  // Lấy ra 20 bản ghi mới nhất (Sắp xếp giảm dần DESC)
  const q =
    "SELECT id, DATE_FORMAT(time, '%H:%i:%s') AS time, lux FROM lux_data ORDER BY id DESC LIMIT 20";

  db.query(q, (err, data) => {
    if (err) return res.status(500).json(err);
    // TRẢ VỀ MẢNG GỐC: Việc đảo mảng để vẽ đồ thị từ trái sang phải sẽ do Frontend App.tsx tự xử lý
    return res.json(data); 
  });
});

// POST: Thêm data từ cảm biến ESP32 đẩy về, lưu trực tiếp lên Aiven Cloud
app.post("/lux", (req, res) => {
  const q = "INSERT INTO lux_data(`time`, `lux`) VALUES (NOW(), ?)";
  const values = [req.body.lux];

  db.query(q, values, (err, data) => {
    if (err) return res.status(500).json(err);
    return res.status(201).json("Lux data has been created.");
  });
});

// Render sẽ tự nạp cổng vào biến process.env.PORT, nếu không có thì mới dùng 8800
const PORT = process.env.PORT || 8800;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Backend đang chạy online tại cổng ${PORT}`);
});