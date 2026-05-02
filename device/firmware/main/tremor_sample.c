#include "tremor_sample.h"

#include <inttypes.h>
#include <stdio.h>
#include <string.h>

void tg_window_begin(tg_window_t *window, uint32_t sequence, int64_t started_at_ms)
{
    memset(window, 0, sizeof(*window));
    window->sequence = sequence;
    window->started_at_ms = started_at_ms;
    window->ended_at_ms = started_at_ms;
}

bool tg_window_append(tg_window_t *window, const tg_sample_t *sample)
{
    if (window->sample_count >= TG_SAMPLES_PER_WINDOW) {
        return false;
    }

    window->samples[window->sample_count] = *sample;
    window->sample_count++;
    window->ended_at_ms = sample->t_ms;
    return true;
}

void tg_window_finish(tg_window_t *window)
{
    if (window->sample_count > 0) {
        window->started_at_ms = window->samples[0].t_ms;
        window->ended_at_ms = window->samples[window->sample_count - 1].t_ms;
    }
}

void tg_sample_log_ndjson(const tg_sample_t *sample)
{
    printf(
        "TG_SAMPLE {\"schema\":\"tg.sample.v1\",\"tMs\":%" PRId64
        ",\"ax\":%d,\"ay\":%d,\"az\":%d,\"gx\":%d,\"gy\":%d,\"gz\":%d,\"temp\":%d}\n",
        sample->t_ms,
        sample->ax,
        sample->ay,
        sample->az,
        sample->gx,
        sample->gy,
        sample->gz,
        sample->temp);
}
