CREATE DATABASE IF NOT EXISTS banco_alimentos DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE banco_alimentos;

-- Tabelas principais
CREATE TABLE IF NOT EXISTS donors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  document VARCHAR(30),
  contact VARCHAR(120),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS institutions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  cnpj VARCHAR(30),
  contact VARCHAR(120),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  category VARCHAR(60),
  unit VARCHAR(20) NOT NULL DEFAULT 'kg'
);

CREATE TABLE IF NOT EXISTS lots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  item_id INT NOT NULL,
  lot_code VARCHAR(60) NOT NULL,
  expires_at DATE NOT NULL,
  UNIQUE KEY uk_lot (item_id, lot_code, expires_at),
  CONSTRAINT fk_lot_item FOREIGN KEY (item_id) REFERENCES items(id)
);

CREATE TABLE IF NOT EXISTS donations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  donor_id INT NOT NULL,
  received_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_donation_donor FOREIGN KEY (donor_id) REFERENCES donors(id)
);

CREATE TABLE IF NOT EXISTS donation_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  donation_id INT NOT NULL,
  lot_id INT NOT NULL,
  quantity DECIMAL(12,3) NOT NULL CHECK (quantity > 0),
  CONSTRAINT fk_di_donation FOREIGN KEY (donation_id) REFERENCES donations(id),
  CONSTRAINT fk_di_lot FOREIGN KEY (lot_id) REFERENCES lots(id)
);

CREATE TABLE IF NOT EXISTS stock (
  lot_id INT PRIMARY KEY,
  quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
  CONSTRAINT fk_stock_lot FOREIGN KEY (lot_id) REFERENCES lots(id)
);

CREATE TABLE IF NOT EXISTS deliveries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  institution_id INT NOT NULL,
  delivered_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_delivery_inst FOREIGN KEY (institution_id) REFERENCES institutions(id)
);

CREATE TABLE IF NOT EXISTS delivery_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  delivery_id INT NOT NULL,
  lot_id INT NOT NULL,
  quantity DECIMAL(12,3) NOT NULL CHECK (quantity > 0),
  CONSTRAINT fk_deli_delivery FOREIGN KEY (delivery_id) REFERENCES deliveries(id),
  CONSTRAINT fk_deli_lot FOREIGN KEY (lot_id) REFERENCES lots(id)
);

-- Segurança (simples)
CREATE TABLE IF NOT EXISTS roles ( id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(40) UNIQUE );
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(120) UNIQUE,
  password_hash VARCHAR(200),
  role_id INT,
  CONSTRAINT fk_user_role FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- Views
CREATE OR REPLACE VIEW vw_estoque_validade AS
SELECT
  l.id AS lot_id,
  i.name AS item_name,
  l.lot_code,
  l.expires_at,
  DATEDIFF(l.expires_at, CURRENT_DATE()) AS days_to_expiry,
  COALESCE(s.quantity,0) AS quantity
FROM lots l
JOIN items i ON i.id = l.item_id
LEFT JOIN stock s ON s.lot_id = l.id;

CREATE OR REPLACE VIEW vw_doacoes_periodo AS
SELECT
  d.id AS donation_id,
  d.received_at,
  it.name AS item_name,
  di.quantity
FROM donation_items di
JOIN donations d ON d.id = di.donation_id
JOIN lots l ON l.id = di.lot_id
JOIN items it ON it.id = l.item_id;

-- Triggers para manter o estoque
DELIMITER $$
CREATE TRIGGER trg_donation_items_ai AFTER INSERT ON donation_items
FOR EACH ROW
BEGIN
  INSERT INTO stock(lot_id, quantity) VALUES (NEW.lot_id, NEW.quantity)
  ON DUPLICATE KEY UPDATE quantity = quantity + NEW.quantity;
END$$

CREATE TRIGGER trg_delivery_items_ai AFTER INSERT ON delivery_items
FOR EACH ROW
BEGIN
  UPDATE stock SET quantity = quantity - NEW.quantity WHERE lot_id = NEW.lot_id;
END$$
DELIMITER ;

-- Procedure simplificada
DELIMITER $$
CREATE PROCEDURE registrar_doacao_simple(
  IN p_donor_id INT,
  IN p_received_at DATETIME,
  IN p_item_id INT,
  IN p_lot_code VARCHAR(60),
  IN p_expires_at DATE,
  IN p_quantity DECIMAL(12,3)
)
BEGIN
  DECLARE v_lot_id INT;
  INSERT INTO donations(donor_id, received_at) VALUES (p_donor_id, p_received_at);
  SET @donation_id = LAST_INSERT_ID();

  SELECT id INTO v_lot_id FROM lots WHERE item_id=p_item_id AND lot_code=p_lot_code AND expires_at=p_expires_at;
  IF v_lot_id IS NULL THEN
    INSERT INTO lots(item_id, lot_code, expires_at) VALUES (p_item_id, p_lot_code, p_expires_at);
    SET v_lot_id = LAST_INSERT_ID();
  END IF;

  INSERT INTO donation_items(donation_id, lot_id, quantity) VALUES (@donation_id, v_lot_id, p_quantity);
END$$
DELIMITER ;
