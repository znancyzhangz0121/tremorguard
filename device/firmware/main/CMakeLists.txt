idf_component_register(
    SRCS
        "hmac_auth.c"
        "main.c"
        "mpu6050.c"
        "ring_buffer.c"
        "tremor_sample.c"
        "uploader.c"
    INCLUDE_DIRS "."
    REQUIRES
        driver
        esp_http_client
        esp_timer
        json
        mbedtls
        nvs_flash
)
