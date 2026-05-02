#include "uploader.h"

#include <inttypes.h>
#include <stdio.h>
#include <string.h>

#include "app_config.h"
#include "esp_check.h"
#include "esp_http_client.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "hmac_auth.h"

#define RAW_BATCH_PATH "/ingestion/raw-batches"
#define HEARTBEAT_PATH_MAX 96
#define NONCE_MAX 32
#define BODY_MAX 2048

static const char *TAG = "tg_uploader";
static tg_uploader_config_t s_config;

static void monotonic_timestamp_seconds(char *out, size_t out_len)
{
    snprintf(out, out_len, "%" PRId64, esp_timer_get_time() / 1000000);
}

static void make_nonce(char *out, size_t out_len)
{
    snprintf(out, out_len, "%" PRId64, esp_timer_get_time());
}

static esp_err_t signed_post(const char *path, const char *body)
{
    char timestamp[24];
    char nonce[NONCE_MAX];
    char auth[TG_AUTH_HEADER_MAX];
    char url[256];

    monotonic_timestamp_seconds(timestamp, sizeof(timestamp));
    make_nonce(nonce, sizeof(nonce));

    ESP_RETURN_ON_ERROR(
        tg_hmac_build_authorization_header(
            s_config.device_id,
            "POST",
            path,
            timestamp,
            nonce,
            (const uint8_t *)body,
            strlen(body),
            s_config.device_secret,
            auth),
        TAG,
        "auth header failed");

    int written = snprintf(url, sizeof(url), "%s%s", s_config.api_base_url, path);
    if (written < 0 || written >= (int)sizeof(url)) {
        return ESP_ERR_INVALID_SIZE;
    }

    esp_http_client_config_t http_config = {
        .url = url,
        .method = HTTP_METHOD_POST,
        .timeout_ms = 5000,
    };

    esp_http_client_handle_t client = esp_http_client_init(&http_config);
    if (client == NULL) {
        return ESP_FAIL;
    }

    esp_http_client_set_header(client, "Content-Type", "application/json");
    esp_http_client_set_header(client, "Authorization", auth);
    esp_http_client_set_post_field(client, body, strlen(body));

    esp_err_t err = esp_http_client_perform(client);
    int status = esp_http_client_get_status_code(client);
    esp_http_client_cleanup(client);

    if (err != ESP_OK) {
        ESP_LOGW(TAG, "POST %s failed: %s", path, esp_err_to_name(err));
        return err;
    }
    if (status < 200 || status >= 300) {
        ESP_LOGW(TAG, "POST %s returned HTTP %d", path, status);
        return ESP_FAIL;
    }

    return ESP_OK;
}

void tg_uploader_init(const tg_uploader_config_t *config)
{
    s_config = *config;
}

esp_err_t tg_uploader_upload_window(const tg_window_t *window)
{
    char body[BODY_MAX];

    /*
     * Review stub:
     * The full 1000-sample body is intentionally not expanded here to keep RAM
     * bounded in the skeleton. Production should stream compact JSON, CBOR, or
     * NDJSON from the persistent ring queue and include per-record checksums.
     */
    int written = snprintf(
        body,
        sizeof(body),
        "{"
        "\"schema\":\"tg.raw_window.v1\","
        "\"deviceId\":\"%s\","
        "\"firmwareVersion\":\"%s\","
        "\"sequence\":%" PRIu32 ","
        "\"sampleRateHz\":%d,"
        "\"windowSeconds\":%d,"
        "\"startedAtMs\":%" PRId64 ","
        "\"endedAtMs\":%" PRId64 ","
        "\"sampleCount\":%u,"
        "\"samplesPreview\":["
        "{\"tMs\":%" PRId64 ",\"ax\":%d,\"ay\":%d,\"az\":%d,\"gx\":%d,\"gy\":%d,\"gz\":%d,\"temp\":%d}"
        "]"
        "}",
        s_config.device_id,
        TG_FIRMWARE_VERSION,
        window->sequence,
        TG_SAMPLE_RATE_HZ,
        TG_WINDOW_SECONDS,
        window->started_at_ms,
        window->ended_at_ms,
        (unsigned)window->sample_count,
        window->sample_count > 0 ? window->samples[0].t_ms : 0,
        window->sample_count > 0 ? window->samples[0].ax : 0,
        window->sample_count > 0 ? window->samples[0].ay : 0,
        window->sample_count > 0 ? window->samples[0].az : 0,
        window->sample_count > 0 ? window->samples[0].gx : 0,
        window->sample_count > 0 ? window->samples[0].gy : 0,
        window->sample_count > 0 ? window->samples[0].gz : 0,
        window->sample_count > 0 ? window->samples[0].temp : 0);
    if (written < 0 || written >= (int)sizeof(body)) {
        return ESP_ERR_INVALID_SIZE;
    }

    ESP_LOGI(TAG, "upload window seq=%" PRIu32 " samples=%u", window->sequence, (unsigned)window->sample_count);
    return signed_post(RAW_BATCH_PATH, body);
}

esp_err_t tg_uploader_send_heartbeat(const tg_heartbeat_status_t *status)
{
    char body[BODY_MAX];
    char path[HEARTBEAT_PATH_MAX];
    int path_written = snprintf(path, sizeof(path), "/devices/%s/heartbeat", s_config.device_id);
    if (path_written < 0 || path_written >= (int)sizeof(path)) {
        return ESP_ERR_INVALID_SIZE;
    }

    int written = snprintf(
        body,
        sizeof(body),
        "{"
        "\"schema\":\"tg.heartbeat.v1\","
        "\"deviceId\":\"%s\","
        "\"firmwareVersion\":\"%s\","
        "\"uptimeMs\":%" PRId64 ","
        "\"batteryMv\":%d,"
        "\"cacheDepth\":%u,"
        "\"cacheCapacity\":%u,"
        "\"sampleRateHz\":%d,"
        "\"clockSynced\":%s"
        "}",
        s_config.device_id,
        TG_FIRMWARE_VERSION,
        status->uptime_ms,
        status->battery_mv,
        (unsigned)status->cache_depth,
        (unsigned)status->cache_capacity,
        TG_SAMPLE_RATE_HZ,
        status->clock_synced ? "true" : "false");
    if (written < 0 || written >= (int)sizeof(body)) {
        return ESP_ERR_INVALID_SIZE;
    }

    return signed_post(path, body);
}
