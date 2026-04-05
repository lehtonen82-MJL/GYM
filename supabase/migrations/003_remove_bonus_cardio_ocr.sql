-- Phase 3 Migration: Remove OCR storage from bonus cardio

alter table if exists workout_bonus_cardio
  drop column if exists raw_ocr_text;
