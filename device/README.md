# TremorGuard Device Workstream

This directory contains the device-side skeleton for the TremorGuard ESP32 + MPU6050 plan. It is intentionally scoped to firmware and local tooling only.

## Layout

- `firmware/` - ESP-IDF style firmware project for ESP32.
- `protocol/` - device upload and heartbeat payload notes.
- `tools/` - Python utilities for serial capture and replay/verify ingestion payloads.
- `samples/` - small sample NDJSON capture for tool smoke tests.

## Firmware Design Snapshot

- Sensor: MPU6050 over I2C.
- Sampling: fixed 100 Hz using a FreeRTOS periodic sampling task.
- Windowing: 10 second windows, exactly 1000 samples per upload batch.
- Sample fields: monotonic timestamp, accelerometer raw axes, gyroscope raw axes, optional temperature raw value.
- Upload: HTTPS JSON skeleton signed with HMAC-SHA256.
- Heartbeat: periodic signed status payload with battery, firmware, cache depth, and clock state.
- Offline cache: in-memory ring buffer placeholder with notes for the production FRAM/EEPROM/NVS implementation required for 72 hour recovery.

## Build Notes

The firmware is structured as an ESP-IDF project:

```sh
cd device/firmware
idf.py set-target esp32
idf.py menuconfig
idf.py build
idf.py flash monitor
```

Set these values in `menuconfig` or via a production provisioning flow before network upload is enabled:

- `CONFIG_TG_DEVICE_ID`
- `CONFIG_TG_DEVICE_SECRET`
- `CONFIG_TG_API_BASE_URL`
- `CONFIG_TG_WIFI_SSID`
- `CONFIG_TG_WIFI_PASSWORD`

The current upload path is a stub suitable for review. WiFi provisioning, CA pinning, persistent cache storage, and backend endpoint finalization still need hardware/backend integration.

## Tooling

Capture serial NDJSON emitted by firmware:

```sh
python3 device/tools/serial_capture.py --port /dev/ttyUSB0 --output /tmp/tg-capture.ndjson --duration 60
```

Replay and verify a capture locally:

```sh
python3 device/tools/replay_verify.py --input /tmp/tg-capture.ndjson --device-id TG-ESP-DEVKIT-001
```

Optionally send signed batches to a backend-compatible endpoint:

```sh
python3 device/tools/replay_verify.py \
  --input /tmp/tg-capture.ndjson \
  --device-id TG-ESP-DEVKIT-001 \
  --secret "$TG_DEVICE_SECRET" \
  --endpoint http://localhost:3000/ingestion/raw-batches
```
