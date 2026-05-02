#include <stdbool.h>
#include <inttypes.h>
#include <stdint.h>

#include "app_config.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "mpu6050.h"
#include "nvs_flash.h"
#include "ring_buffer.h"
#include "sdkconfig.h"
#include "tremor_sample.h"
#include "uploader.h"

static const char *TAG = "tremorguard";

static tg_window_ring_t s_cache;
static tg_window_t s_active_window;
static uint32_t s_next_sequence = 1;

static int read_battery_mv_stub(void)
{
    return 4100;
}

static bool network_ready_stub(void)
{
    /*
     * TODO: replace with WiFi provisioning and event-group state.
     * Returning false keeps first hardware bring-up in offline-cache mode.
     */
    return false;
}

static void flush_cache_if_online(void)
{
    if (!network_ready_stub()) {
        return;
    }

    tg_window_t pending;
    while (tg_window_ring_peek(&s_cache, &pending)) {
        if (tg_uploader_upload_window(&pending) != ESP_OK) {
            break;
        }
        tg_window_ring_pop(&s_cache);
    }
}

static void sampling_task(void *arg)
{
    (void)arg;

    TickType_t last_wake = xTaskGetTickCount();
    const TickType_t period = pdMS_TO_TICKS(1000 / TG_SAMPLE_RATE_HZ);
    tg_window_begin(&s_active_window, s_next_sequence++, esp_timer_get_time() / 1000);

    while (true) {
        tg_sample_t sample;
        esp_err_t err = tg_mpu6050_read_sample(&sample);
        if (err == ESP_OK) {
            tg_window_append(&s_active_window, &sample);

            if ((s_active_window.sample_count % TG_SAMPLE_RATE_HZ) == 0) {
                tg_sample_log_ndjson(&sample);
            }

            if (s_active_window.sample_count >= TG_SAMPLES_PER_WINDOW) {
                tg_window_finish(&s_active_window);
                bool retained = tg_window_ring_push(&s_cache, &s_active_window);
                ESP_LOGI(
                    TAG,
                    "closed 10s window seq=%" PRIu32 " samples=%u cache=%u retained=%s",
                    s_active_window.sequence,
                    (unsigned)s_active_window.sample_count,
                    (unsigned)tg_window_ring_count(&s_cache),
                    retained ? "true" : "false");

                flush_cache_if_online();
                tg_window_begin(&s_active_window, s_next_sequence++, esp_timer_get_time() / 1000);
            }
        } else {
            ESP_LOGW(TAG, "sample read failed: %s", esp_err_to_name(err));
        }

        vTaskDelayUntil(&last_wake, period);
    }
}

static void heartbeat_task(void *arg)
{
    (void)arg;

    while (true) {
        tg_heartbeat_status_t status = {
            .uptime_ms = esp_timer_get_time() / 1000,
            .battery_mv = read_battery_mv_stub(),
            .cache_depth = tg_window_ring_count(&s_cache),
            .cache_capacity = TG_OFFLINE_WINDOW_CACHE_CAPACITY,
            .clock_synced = false,
        };

        if (network_ready_stub()) {
            esp_err_t err = tg_uploader_send_heartbeat(&status);
            if (err != ESP_OK) {
                ESP_LOGW(TAG, "heartbeat failed: %s", esp_err_to_name(err));
            }
        } else {
            ESP_LOGI(
                TAG,
                "heartbeat offline uptime_ms=%lld battery_mv=%d cache=%u/%u dropped=%u",
                (long long)status.uptime_ms,
                status.battery_mv,
                (unsigned)status.cache_depth,
                (unsigned)status.cache_capacity,
                (unsigned)tg_window_ring_dropped(&s_cache));
        }

        vTaskDelay(pdMS_TO_TICKS(TG_HEARTBEAT_INTERVAL_SECONDS * 1000));
    }
}

void app_main(void)
{
    ESP_ERROR_CHECK(nvs_flash_init());
    tg_window_ring_init(&s_cache);

    tg_uploader_config_t uploader_config = {
        .device_id = CONFIG_TG_DEVICE_ID,
        .device_secret = CONFIG_TG_DEVICE_SECRET,
        .api_base_url = CONFIG_TG_API_BASE_URL,
    };
    tg_uploader_init(&uploader_config);

    ESP_ERROR_CHECK(tg_mpu6050_init());

    ESP_LOGI(
        TAG,
        "TremorGuard firmware %s sampling=%dHz window=%ds",
        TG_FIRMWARE_VERSION,
        TG_SAMPLE_RATE_HZ,
        TG_WINDOW_SECONDS);

    xTaskCreatePinnedToCore(sampling_task, "tg_sampling", 8192, NULL, 5, NULL, 1);
    xTaskCreate(heartbeat_task, "tg_heartbeat", 4096, NULL, 3, NULL);
}
