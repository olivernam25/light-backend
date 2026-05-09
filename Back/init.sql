-- Chạy file này để khởi tạo database
-- Cách chạy: mysql -u root -p < init.sql

CREATE DATABASE IF NOT EXISTS lightdbx;
USE lightdbx;

CREATE TABLE IF NOT EXISTS lux_data (
  id   INT AUTO_INCREMENT PRIMARY KEY,
  time DATETIME NOT NULL,
  lux  INT NOT NULL
);

-- Dữ liệu mẫu để test giao diện (tuỳ chọn, xoá đi nếu không cần)
INSERT INTO lux_data (time, lux) VALUES
  (NOW() - INTERVAL 95 SECOND, 450),
  (NOW() - INTERVAL 90 SECOND, 520),
  (NOW() - INTERVAL 85 SECOND, 610),
  (NOW() - INTERVAL 80 SECOND, 700),
  (NOW() - INTERVAL 75 SECOND, 680),
  (NOW() - INTERVAL 70 SECOND, 750),
  (NOW() - INTERVAL 65 SECOND, 820),
  (NOW() - INTERVAL 60 SECOND, 900),
  (NOW() - INTERVAL 55 SECOND, 870),
  (NOW() - INTERVAL 50 SECOND, 950),
  (NOW() - INTERVAL 45 SECOND, 1020),
  (NOW() - INTERVAL 40 SECOND, 1100),
  (NOW() - INTERVAL 35 SECOND, 1050),
  (NOW() - INTERVAL 30 SECOND, 1150),
  (NOW() - INTERVAL 25 SECOND, 1200),
  (NOW() - INTERVAL 20 SECOND, 1180),
  (NOW() - INTERVAL 15 SECOND, 1240),
  (NOW() - INTERVAL 10 SECOND, 1300),
  (NOW() - INTERVAL 5 SECOND,  1260),
  (NOW(),                       1240);
