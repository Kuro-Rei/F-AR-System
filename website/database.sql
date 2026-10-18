CREATE DATABASE IF NOT EXISTS ledger_db;
USE ledger_db;

CREATE TABLE users (
    user_id       INT AUTO_INCREMENT PRIMARY KEY,
    username      VARCHAR(50)  NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name     VARCHAR(100) NOT NULL,
    role          VARCHAR(10)  NOT NULL
);



CREATE TABLE import_records (
    import_id   INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT          NOT NULL,
    file_name   VARCHAR(255) NOT NULL,
    row_count   INT          NOT NULL,
    imported_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);


CREATE TABLE location (
    location_id   INT AUTO_INCREMENT PRIMARY KEY,
    location_name VARCHAR(50) NOT NULL UNIQUE
);


CREATE TABLE booking (
    booking_id   INT AUTO_INCREMENT PRIMARY KEY,
    import_id    INT  NOT NULL,
    location_id  INT  NOT NULL,
    booking_date DATE NOT NULL,
    quantity     INT NULL CHECK (quantity > 0),
    deleted_at   DATETIME NULL,   -- NULL = active, has a date = in Trash
    deleted_by   INT NULL,        -- who moved it to Trash
    FOREIGN KEY (import_id)   REFERENCES import_records(import_id),
    FOREIGN KEY (location_id) REFERENCES location(location_id),
    FOREIGN KEY (deleted_by)  REFERENCES users(user_id)
);


CREATE TABLE salt (
    salt_id    INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL UNIQUE,
    size_kilos DECIMAL(6,2) NULL CHECK (size_kilos > 0),
    FOREIGN KEY (booking_id) REFERENCES booking(booking_id)
);


CREATE TABLE price (
    price_id   INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL UNIQUE,
    price      DECIMAL(10,2) NULL CHECK (price >= 0),
    FOREIGN KEY (booking_id) REFERENCES booking(booking_id)
);


CREATE TABLE activity_logs (
    log_id     INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT         NOT NULL,
    booking_id INT         NULL,
    action     VARCHAR(20) NOT NULL,   -- example: 'DELETE', 'RESTORE', 'IMPORT'
    details    VARCHAR(255) NULL,
    logged_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)    REFERENCES users(user_id),
    FOREIGN KEY (booking_id) REFERENCES booking(booking_id)
);


-- LOGIN ACCOUNTS (only these two)
--   Admin / Admin123
--   User  / User123
INSERT INTO users (username, password_hash, full_name, role) VALUES
('Admin', 'scrypt:32768:8:1$6tsoSgvuNF9DpEER$c8267c5608b1d925c547c473f01d5570f9f985057477ef9d554d0a0de8f904d60dd187ad0ae4ccead27b34559afb376937d228efe1c43a88f899102463bbb89d', 'Administrator', 'Admin'),
('User',  'scrypt:32768:8:1$uYB64nxqyEzzKtDG$4ccf42ba2b718230207fc465adead2fd947c51c93a018ca9c6a08a47ad5490cebb7887b134f231df8638f71ccc4762ee001a6ec5877fd3462b6b7cd37f468d91', 'Regular User', 'User');


