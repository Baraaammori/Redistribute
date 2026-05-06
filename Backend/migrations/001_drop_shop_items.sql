-- Migration 001: Remove creator equipment shop table
-- This table is no longer part of the simple-saas feature set.
DROP TABLE IF EXISTS shop_items CASCADE;
