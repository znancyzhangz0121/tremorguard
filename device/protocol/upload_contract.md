# Device Upload Contract Draft

This draft documents the device-side payloads expected by the firmware and replay tools. It is a working contract for review and backend alignment.

## Sampling Contract

- `sample_rate_hz`: `100`
- `window_seconds`: `10`
- `samples_per_window`: `1000`
- Timestamp source: device monotonic millisecond clock plus wall-clock synchronization when available.
- Axis units in firmware skeleton: raw MPU6050 counts.
- Production conversion targets:
  - accelerometer: g or mg after calibration.
  - gyroscope: deg/s after calibration.

## Raw Batch Payload

```json
{
  "schema": "tg.raw_window.v1",
  "deviceId": "TG-ESP-DEVKIT-001",
  "firmwareVersion": "0.1.0-device-skeleton",
  "sequence": 42,
  "sampleRateHz": 100,
  "windowSeconds": 10,
  "startedAtMs": 123456789,
  "endedAtMs": 123466789,
  "sampleCount": 1000,
  "samples": [
    {
      "tMs": 123456789,
      "ax": 12,
      "ay": -31,
      "az": 16384,
      "gx": 4,
      "gy": -2,
      "gz": 1,
      "temp": 0
    }
  ]
}
```

## Heartbeat Payload

```json
{
  "schema": "tg.heartbeat.v1",
  "deviceId": "TG-ESP-DEVKIT-001",
  "firmwareVersion": "0.1.0-device-skeleton",
  "uptimeMs": 120000,
  "batteryMv": 4100,
  "cacheDepth": 3,
  "cacheCapacity": 2160,
  "sampleRateHz": 100,
  "clockSynced": false
}
```

## HMAC Header

The signing material is:

```text
METHOD
PATH
TIMESTAMP_SECONDS
NONCE
SHA256_HEX(BODY)
```

The signature is HMAC-SHA256 over that material using the provisioned per-device secret.

Header draft:

```text
Authorization: TG-HMAC-SHA256 device="TG-ESP-DEVKIT-001",ts="1777700000",nonce="abc123",sig="hex"
```

Replay protection is expected to be enforced server-side using `(deviceId, ts, nonce)` with a narrow timestamp tolerance.

## Offline Cache Notes

The PRD requires at least 72 hours of recoverable local feature/raw-window logs. At 10 second windows this is:

```text
72 hours * 360 windows/hour = 25920 windows
```

The firmware skeleton uses a small RAM ring buffer for review. Production should replace it with a wear-aware persistent queue:

- Preferred: FRAM ring queue with monotonically increasing sequence numbers.
- Acceptable early prototype: NVS partition with append-only pages and compaction.
- Required metadata per record: sequence, created monotonic time, wall-clock time if synced, payload length, payload checksum, upload state.
- Recovery behavior: upload oldest durable window first, preserve order, only mark acknowledged after HTTP 2xx and valid response body.
