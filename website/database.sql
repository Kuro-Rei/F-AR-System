CREATE DATABASE IF NOT EXISTS ledger_db;

USE ledger_db;

CREATE TABLE
    users (
        user_id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(100) NOT NULL,
        role ENUM ('Owner', 'Sales manager') NOT NULL DEFAULT 'Sales manager',
        email VARCHAR(100) NULL UNIQUE,
        reset_password_hash CHAR(64) NULL UNIQUE,
        reset_password_expiration DATETIME NULL
    );

CREATE TABLE
    import_records (
        import_id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        row_count INT NOT NULL,
        imported_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (user_id)
    );

CREATE TABLE
    location (
        location_id INT AUTO_INCREMENT PRIMARY KEY,
        location_name VARCHAR(50) NOT NULL UNIQUE
    );

CREATE TABLE
    booking (
        booking_id INT AUTO_INCREMENT PRIMARY KEY,
        import_id INT NOT NULL,
        location_id INT NOT NULL,
        booking_date DATE NOT NULL,
        quantity INT NULL CHECK (quantity > 0),
        archived_at DATETIME NULL,
        archived_by INT NULL,
        FOREIGN KEY (import_id) REFERENCES import_records (import_id),
        FOREIGN KEY (location_id) REFERENCES location (location_id),
        FOREIGN KEY (archived_by) REFERENCES users (user_id)
    );

CREATE TABLE
    salt (
        salt_id INT AUTO_INCREMENT PRIMARY KEY,
        booking_id INT NOT NULL UNIQUE,
        size_kilos DECIMAL(6, 2) NULL CHECK (size_kilos > 0),
        FOREIGN KEY (booking_id) REFERENCES booking (booking_id)
    );

CREATE TABLE
    price (
        price_id INT AUTO_INCREMENT PRIMARY KEY,
        booking_id INT NOT NULL UNIQUE,
        price DECIMAL(10, 2) NULL CHECK (price >= 0),
        FOREIGN KEY (booking_id) REFERENCES booking (booking_id)
    );

CREATE TABLE
    activity_logs (
        log_id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        booking_id INT NULL,
        action VARCHAR(20) NOT NULL,
        details VARCHAR(255) NULL,
        logged_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (user_id),
        FOREIGN KEY (booking_id) REFERENCES booking (booking_id)
    );