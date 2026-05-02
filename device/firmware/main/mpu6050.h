#pragma once

#include "esp_err.h"
#include "tremor_sample.h"

esp_err_t tg_mpu6050_init(void);
esp_err_t tg_mpu6050_read_sample(tg_sample_t *sample);
