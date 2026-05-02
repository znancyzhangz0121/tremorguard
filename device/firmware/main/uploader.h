#pragma once

#include <stdbool.h>
#include <stddef.h>

#include "esp_err.h"
#include "tremor_sample.h"

typedef struct {
    const char *device_id;
    const char *device_secret;
    const char *api_base_url;
} tg_uploader_config_t;

typedef struct {
    int64_t uptime_ms;
    int battery_mv;
    size_t cache_depth;
    size_t cache_capacity;
    bool clock_synced;
} tg_heartbeat_status_t;

void tg_uploader_init(const tg_uploader_config_t *config);
esp_err_t tg_uploader_upload_window(const tg_window_t *window);
esp_err_t tg_uploader_send_heartbeat(const tg_heartbeat_status_t *status);
