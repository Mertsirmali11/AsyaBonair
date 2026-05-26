-- Eski ON DELETE SET NULL davranışından kalan yetim görevler (toplantı silinmiş, meeting_id boş).
-- Toplantısız Action Plan görevleri de meeting_id NULL olabilir; bu betik hepsini siler.
-- Yedek aldıktan sonra çalıştırın.

DELETE FROM meeting_tasks
WHERE meeting_id IS NULL;
