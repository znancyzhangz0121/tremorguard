#pragma once

#define TG_FIRMWARE_VERSION "0.1.0-device-skeleton"

#define TG_SAMPLE_RATE_HZ 100
#define TG_WINDOW_SECONDS 10
#define TG_SAMPLES_PER_WINDOW (TG_SAMPLE_RATE_HZ * TG_WINDOW_SECONDS)

#define TG_HEARTBEAT_INTERVAL_SECONDS 60

/*
 * Review skeleton cache capacity.
 *
 * Production requirement from the PRD is 72 hours of recoverable local logs:
 * 72 * 60 * 60 / 10 = 25920 windows.
 *
 * This RAM queue is intentionally small for ESP-IDF bring-up. Replace with a
 * persistent FRAM/EEPROM/NVS ring queue before field testing.
 */
#define TG_OFFLINE_WINDOW_CACHE_CAPACITY 8
