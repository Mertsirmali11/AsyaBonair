-- Opsiyonel: Eski davranıştaki (kod sabit liste) departmanları tabloya almak için.
-- Çalıştırmadan önce `custom_departments` şemasında `name` üzerinde UNIQUE olduğundan emin olun.
INSERT INTO custom_departments (name)
VALUES
  ('Maintenance'),
  ('Human Resources'),
  ('Handling'),
  ('Camo'),
  ('Engineering'),
  ('Kitchen & Cleaning Staff'),
  ('Supply'),
  ('Accounting'),
  ('Compliance'),
  ('Quality'),
  ('Admin'),
  ('Administrative Affairs'),
  ('IT'),
  ('Planning'),
  ('Pilot')
ON CONFLICT (name) DO NOTHING;
