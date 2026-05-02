#pragma once

#include <stddef.h>
#include <stdint.h>

#include "esp_err.h"

#define TG_SHA256_HEX_LEN 65
#define TG_HMAC_HEX_LEN 65
#define TG_AUTH_HEADER_MAX 256

esp_err_t tg_sha256_hex(const uint8_t *body, size_t body_len, char out_hex[TG_SHA256_HEX_LEN]);
esp_err_t tg_hmac_signature_hex(
    const char *method,
    const char *path,
    const char *timestamp,
    const char *nonce,
    const char *body_sha256_hex,
    const char *secret,
    char out_hex[TG_HMAC_HEX_LEN]);
esp_err_t tg_hmac_build_authorization_header(
    const char *device_id,
    const char *method,
    const char *path,
    const char *timestamp,
    const char *nonce,
    const uint8_t *body,
    size_t body_len,
    const char *secret,
    char out_header[TG_AUTH_HEADER_MAX]);
