INSERT INTO organizations (name) 
VALUES
('Digivla'),
('Klien B');

INSERT INTO users (organization_id, name, email, password_hash, role)
VALUES
(1, 'Admin Satu', 'admin1@example.com', '$2b$10$ddL.kQLQmo6Rn2W7cbgmZukxcZqQL89uZlZ9.sbEcyq7Q/wypWrYG', 'admin'),
(1, 'User Satu', 'user1@example.com', '$2b$10$ddL.kQLQmo6Rn2W7cbgmZukxcZqQL89uZlZ9.sbEcyq7Q/wypWrYG', 'user'),
(2, 'Admin Dua', 'admin2@example.com', '$2b$10$ddL.kQLQmo6Rn2W7cbgmZukxcZqQL89uZlZ9.sbEcyq7Q/wypWrYG', 'admin');

INSERT INTO articles 
(organization_id, title, content, url, source, author, sentiment, published_at)
VALUES
(1, 'Banjir Jakarta', 'Hujan deras sejak pagi merendam beberapa wilayah.', 'https://kompas.com/a', 'kompas.com', 'Andi', 'negative', '2026-11-01 07:00:00+07'),
(1, 'Rupiah menguat', 'Rupiah ditutup menguat terhadap dolar AS.', 'https://detik.com/b', 'detik.com', NULL, 'positive', '2026-11-05 15:30:00+07'),
(2, 'Pemilu 2029', 'KPU mulai menyiapkan tahapan pemilu.', 'https://tempo.co/c', 'tempo.co', 'Budi', 'neutral', '2026-11-10 10:00:00+07');
