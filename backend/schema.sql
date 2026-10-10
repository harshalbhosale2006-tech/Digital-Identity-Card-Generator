CREATE DATABASE IF NOT EXISTS digital_id_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE digital_id_db;
CREATE TABLE IF NOT EXISTS admin_users (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL,
 email VARCHAR(160) NOT NULL UNIQUE, username VARCHAR(60) NOT NULL UNIQUE,
 password_hash VARCHAR(100) NOT NULL, created_at DATETIME NOT NULL
);
CREATE TABLE IF NOT EXISTS identity_cards (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY, full_name VARCHAR(120) NOT NULL,
 id_number VARCHAR(60) NOT NULL UNIQUE, dob DATE NULL, department VARCHAR(120) NULL,
 course VARCHAR(120) NULL, academic_year VARCHAR(40) NULL, semester VARCHAR(40) NULL,
 email VARCHAR(160) NULL, phone VARCHAR(30) NULL, blood_group VARCHAR(8) NULL,
 address VARCHAR(1000) NULL, photo LONGTEXT NULL, status VARCHAR(20) NOT NULL DEFAULT 'Active',
 verification_token VARCHAR(64) NULL UNIQUE,
 card_type VARCHAR(32) NOT NULL DEFAULT 'STUDENT', category_details LONGTEXT NULL,
 created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL,
 INDEX idx_card_full_name (full_name), INDEX idx_card_department (department), INDEX idx_card_status (status)
);
