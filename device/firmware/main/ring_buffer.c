#include "ring_buffer.h"

#include <string.h>

void tg_window_ring_init(tg_window_ring_t *ring)
{
    memset(ring, 0, sizeof(*ring));
}

bool tg_window_ring_push(tg_window_ring_t *ring, const tg_window_t *window)
{
    size_t index = (ring->head + ring->count) % TG_OFFLINE_WINDOW_CACHE_CAPACITY;

    if (ring->count == TG_OFFLINE_WINDOW_CACHE_CAPACITY) {
        ring->dropped++;
        ring->head = (ring->head + 1) % TG_OFFLINE_WINDOW_CACHE_CAPACITY;
        index = (ring->head + ring->count - 1) % TG_OFFLINE_WINDOW_CACHE_CAPACITY;
    } else {
        ring->count++;
    }

    ring->windows[index] = *window;
    return ring->dropped == 0;
}

bool tg_window_ring_peek(const tg_window_ring_t *ring, tg_window_t *window)
{
    if (ring->count == 0) {
        return false;
    }

    *window = ring->windows[ring->head];
    return true;
}

bool tg_window_ring_pop(tg_window_ring_t *ring)
{
    if (ring->count == 0) {
        return false;
    }

    ring->head = (ring->head + 1) % TG_OFFLINE_WINDOW_CACHE_CAPACITY;
    ring->count--;
    return true;
}

size_t tg_window_ring_count(const tg_window_ring_t *ring)
{
    return ring->count;
}

size_t tg_window_ring_dropped(const tg_window_ring_t *ring)
{
    return ring->dropped;
}
