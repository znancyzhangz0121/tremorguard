#pragma once

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#include "app_config.h"

typedef struct {
    int64_t t_ms;
    int16_t ax;
    int16_t ay;
    int16_t az;
    int16_t gx;
    int16_t gy;
    int16_t gz;
    int16_t temp;
} tg_sample_t;

typedef struct {
    uint32_t sequence;
    int64_t started_at_ms;
    int64_t ended_at_ms;
    size_t sample_count;
    tg_sample_t samples[TG_SAMPLES_PER_WINDOW];
} tg_window_t;

void tg_window_begin(tg_window_t *window, uint32_t sequence, int64_t started_at_ms);
bool tg_window_append(tg_window_t *window, const tg_sample_t *sample);
void tg_window_finish(tg_window_t *window);
void tg_sample_log_ndjson(const tg_sample_t *sample);
