import mysql from "mysql2";
import express from "express";
import cors from "cors";

const app = express();

app.use(express.json());
app.use(cors());

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "123123", // ← Đổi thành mật khẩu MySQL của bạn
  database: "lightdbx",
});

db.connect((err) => {
  if (err) {
    console.error("❌ Kết nối MySQL thất bại:", err.message);
    process.exit(1);
  }
  console.log("✅ Đã kết nối MySQL!");
});

// GET: Lấy 20 bản ghi mới nhất
app.get("/lux", (req, res) => {
  const q =
    "SELECT id, DATE_FORMAT(time, '%H:%i:%s') AS time, lux FROM lux_data ORDER BY id DESC LIMIT 20";

  db.query(q, (err, data) => {
    if (err) return res.json(err);
    return res.json(data.reverse());
  });
});

// POST: Thêm data từ cảm biến ESP32
app.post("/lux", (req, res) => {
  const q = "INSERT INTO lux_data(`time`, `lux`) VALUES (NOW(), ?)";
  const values = [req.body.lux];

  db.query(q, values, (err, data) => {
    if (err) return res.json(err);
    return res.json("Lux data has been created.");
  });
});

app.listen(8800, () => {
  console.log("🚀 Backend chạy tại http://localhost:8800");
});