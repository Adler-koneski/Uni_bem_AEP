USE banco_alimentos;

INSERT INTO roles(name) VALUES ('admin'),('operacional'),('leitura');

INSERT INTO donors(name, document, contact) VALUES
('Mercado Boa Vizinhança','12.345.678/0001-90','(43) 3333-0001'),
('Atacadão Solidário','98.765.432/0001-01','(43) 3333-0002');

INSERT INTO institutions(name, cnpj, contact) VALUES
('Creche Sementes do Amanhã','11.222.333/0001-44','(43) 3333-0101'),
('Casa de Acolhimento Esperança','22.333.444/0001-55','(43) 3333-0102');

INSERT INTO items(name, category, unit) VALUES
('Arroz','Grãos','kg'),
('Leite','Laticínios','L');

INSERT INTO lots(item_id, lot_code, expires_at) VALUES
(1,'LAR-2025-11','2025-11-30'),
(2,'LLT-2026-01','2026-01-15');

CALL registrar_doacao_simple(1, NOW(), 1, 'LAR-2025-11', '2025-11-30', 100.000);
CALL registrar_doacao_simple(2, NOW(), 2, 'LLT-2026-01', '2026-01-15', 80.000);
