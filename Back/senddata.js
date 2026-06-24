import mysql from "mysql2";
import express from "express";
import cors from "cors";

const app = express();

app.use(express.json());
app.use(cors());

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "123123", // Mật khẩu của bạn
  database: "lightdbx",
});

db.connect((err) => {
  if (err) {
    console.error("❌ Kết nối MySQL thất bại:", err.message);
    process.exit(1);
  }
  console.log("✅ Đã kết nối MySQL!");
  
  // Bắt đầu gửi data random sau khi kết nối thành công
  startRandomDataInterval();
});

// --- Đoạn code thêm mới để gửi data random ---

function startRandomDataInterval() {
  // Cứ mỗi 5 giây (5000ms) sẽ gửi data một lần
  setInterval(() => {
    // 1. Tạo giá trị lux ngẫu nhiên (Ví dụ từ 100 đến 1500)
    const randomLux = Math.floor(Math.random() * (1500 - 100 + 1)) + 100;
    
    // 2. Lấy thời gian hiện tại theo định dạng YYYY-MM-DD HH:mm:ss giống trong DB của bạn
    const currentTime = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // 3. Câu lệnh SQL Insert (Bảng của bạn tự tăng id nên chỉ cần truyền time và lux)
    const sql = "INSERT INTO lux_data (time, lux) VALUES (?, ?)";
    
    db.query(sql, [currentTime, randomLux], (err, result) => {
      if (err) {
        console.error("❌ Lỗi khi chèn dữ liệu:", err.message);
      } else {
        console.log(`📥 Đã chèn thành công: Time = ${currentTime} | Lux = ${randomLux}`);
      }
    });

  }, 5000); 
}

// Giữ lại các router GET hoặc lắng nghe port bên dưới của bạn
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server chạy tại http://localhost:${PORT}`);
});