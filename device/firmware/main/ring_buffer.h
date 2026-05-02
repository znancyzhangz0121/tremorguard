#pragma once

#include <stdbool.h>
#include <stddef.h>

#include "tremor_sample.h"

typedef struct {
    tg_window_t windows[TG_OFFLINE_WINDOW_CACHE_CAPACITY];
    size_t head;
    size_t count;
    size_t dropped;
} tg_window_ring_t;

void tg_window_ring_init(tg_window_ring_t *ring);
bool tg_window_ring_push(tg_window_ring_t *ring, const tg_window_t *window);
bool tg_window_ring_peek(const tg_window_ring_t *ring, tg_window_t *window);
bool tg_window_ring_pop(tg_window_ring_t *ring);
size_t tg_window_ring_count(const tg_window_ring_t *ring);
size_t tg_window_ring_dropped(const tg_window_ring_t *ring);
