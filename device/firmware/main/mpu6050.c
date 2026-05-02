#include "mpu6050.h"

#include <string.h>

#include "driver/i2c.h"
#include "esp_check.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "sdkconfig.h"

#define MPU6050_ADDR 0x68
#define MPU6050_PWR_MGMT_1 0x6B
#define MPU6050_SMPLRT_DIV 0x19
#define MPU6050_CONFIG 0x1A
#define MPU6050_GYRO_CONFIG 0x1B
#define MPU6050_ACCEL_CONFIG 0x1C
#define MPU6050_ACCEL_XOUT_H 0x3B

static const char *TAG = "tg_mpu6050";

static int16_t read_be_i16(const uint8_t *data)
{
    return (int16_t)((data[0] << 8) | data[1]);
}

static esp_err_t write_reg(uint8_t reg, uint8_t value)
{
    return i2c_master_write_to_device(
        CONFIG_TG_I2C_PORT,
        MPU6050_ADDR,
        (uint8_t[]){reg, value},
        2,
        pdMS_TO_TICKS(100));
}

static esp_err_t read_regs(uint8_t reg, uint8_t *data, size_t len)
{
    return i2c_master_write_read_device(
        CONFIG_TG_I2C_PORT,
        MPU6050_ADDR,
        &reg,
        1,
        data,
        len,
        pdMS_TO_TICKS(100));
}

esp_err_t tg_mpu6050_init(void)
{
    i2c_config_t config = {
        .mode = I2C_MODE_MASTER,
        .sda_io_num = CONFIG_TG_I2C_SDA_GPIO,
        .scl_io_num = CONFIG_TG_I2C_SCL_GPIO,
        .sda_pullup_en = GPIO_PULLUP_ENABLE,
        .scl_pullup_en = GPIO_PULLUP_ENABLE,
        .master.clk_speed = 400000,
    };

    ESP_RETURN_ON_ERROR(i2c_param_config(CONFIG_TG_I2C_PORT, &config), TAG, "i2c_param_config failed");
    ESP_RETURN_ON_ERROR(
        i2c_driver_install(CONFIG_TG_I2C_PORT, config.mode, 0, 0, 0),
        TAG,
        "i2c_driver_install failed");

    ESP_RETURN_ON_ERROR(write_reg(MPU6050_PWR_MGMT_1, 0x00), TAG, "wake failed");

    /*
     * MPU6050 sample-rate design:
     * - Gyro output rate is 1 kHz when DLPF is enabled.
     * - SMPLRT_DIV = 9 yields 100 Hz: 1000 / (1 + 9).
     * - DLPF config 3 is a conservative starting point for tremor capture.
     */
    ESP_RETURN_ON_ERROR(write_reg(MPU6050_CONFIG, 0x03), TAG, "dlpf config failed");
    ESP_RETURN_ON_ERROR(write_reg(MPU6050_SMPLRT_DIV, 9), TAG, "sample divider failed");
    ESP_RETURN_ON_ERROR(write_reg(MPU6050_GYRO_CONFIG, 0x00), TAG, "gyro range failed");
    ESP_RETURN_ON_ERROR(write_reg(MPU6050_ACCEL_CONFIG, 0x00), TAG, "accel range failed");

    ESP_LOGI(TAG, "MPU6050 initialized for %d Hz sampling", TG_SAMPLE_RATE_HZ);
    return ESP_OK;
}

esp_err_t tg_mpu6050_read_sample(tg_sample_t *sample)
{
    uint8_t raw[14];
    memset(raw, 0, sizeof(raw));
    ESP_RETURN_ON_ERROR(read_regs(MPU6050_ACCEL_XOUT_H, raw, sizeof(raw)), TAG, "read sample failed");

    sample->t_ms = esp_timer_get_time() / 1000;
    sample->ax = read_be_i16(&raw[0]);
    sample->ay = read_be_i16(&raw[2]);
    sample->az = read_be_i16(&raw[4]);
    sample->temp = read_be_i16(&raw[6]);
    sample->gx = read_be_i16(&raw[8]);
    sample->gy = read_be_i16(&raw[10]);
    sample->gz = read_be_i16(&raw[12]);
    return ESP_OK;
}
