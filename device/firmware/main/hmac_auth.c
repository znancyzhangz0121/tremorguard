#include "hmac_auth.h"

#include <stdio.h>
#include <string.h>

#include "esp_check.h"
#include "mbedtls/md.h"
#include "mbedtls/sha256.h"

static void bytes_to_hex(const uint8_t *bytes, size_t len, char *out)
{
    static const char digits[] = "0123456789abcdef";
    for (size_t i = 0; i < len; i++) {
        out[i * 2] = digits[(bytes[i] >> 4) & 0x0f];
        out[i * 2 + 1] = digits[bytes[i] & 0x0f];
    }
    out[len * 2] = '\0';
}

esp_err_t tg_sha256_hex(const uint8_t *body, size_t body_len, char out_hex[TG_SHA256_HEX_LEN])
{
    uint8_t digest[32];
    int rc = mbedtls_sha256(body, body_len, digest, 0);
    if (rc != 0) {
        return ESP_FAIL;
    }

    bytes_to_hex(digest, sizeof(digest), out_hex);
    return ESP_OK;
}

esp_err_t tg_hmac_signature_hex(
    const char *method,
    const char *path,
    const char *timestamp,
    const char *nonce,
    const char *body_sha256_hex,
    const char *secret,
    char out_hex[TG_HMAC_HEX_LEN])
{
    char signing_material[256];
    int written = snprintf(
        signing_material,
        sizeof(signing_material),
        "%s\n%s\n%s\n%s\n%s",
        method,
        path,
        timestamp,
        nonce,
        body_sha256_hex);
    if (written < 0 || written >= (int)sizeof(signing_material)) {
        return ESP_ERR_INVALID_SIZE;
    }

    uint8_t digest[32];
    const mbedtls_md_info_t *info = mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
    if (info == NULL) {
        return ESP_FAIL;
    }

    int rc = mbedtls_md_hmac(
        info,
        (const uint8_t *)secret,
        strlen(secret),
        (const uint8_t *)signing_material,
        strlen(signing_material),
        digest);
    if (rc != 0) {
        return ESP_FAIL;
    }

    bytes_to_hex(digest, sizeof(digest), out_hex);
    return ESP_OK;
}

esp_err_t tg_hmac_build_authorization_header(
    const char *device_id,
    const char *method,
    const char *path,
    const char *timestamp,
    const char *nonce,
    const uint8_t *body,
    size_t body_len,
    const char *secret,
    char out_header[TG_AUTH_HEADER_MAX])
{
    char body_hash[TG_SHA256_HEX_LEN];
    char signature[TG_HMAC_HEX_LEN];

    ESP_RETURN_ON_ERROR(tg_sha256_hex(body, body_len, body_hash), "tg_hmac", "sha256 failed");
    ESP_RETURN_ON_ERROR(
        tg_hmac_signature_hex(method, path, timestamp, nonce, body_hash, secret, signature),
        "tg_hmac",
        "hmac failed");

    int written = snprintf(
        out_header,
        TG_AUTH_HEADER_MAX,
        "TG-HMAC-SHA256 device=\"%s\",ts=\"%s\",nonce=\"%s\",sig=\"%s\"",
        device_id,
        timestamp,
        nonce,
        signature);
    if (written < 0 || written >= TG_AUTH_HEADER_MAX) {
        return ESP_ERR_INVALID_SIZE;
    }

    return ESP_OK;
}
