#!/usr/bin/env python3
"""Capture TremorGuard firmware serial NDJSON."""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Any


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", required=True, help="Serial port, for example /dev/ttyUSB0 or /dev/cu.usbserial-*")
    parser.add_argument("--baud", type=int, default=115200, help="Serial baud rate")
    parser.add_argument("--output", required=True, type=Path, help="Output NDJSON path")
    parser.add_argument("--duration", type=float, default=0, help="Seconds to capture; 0 means until interrupted")
    parser.add_argument("--prefix", default="TG_SAMPLE ", help="Line prefix before JSON payload")
    parser.add_argument("--raw", action="store_true", help="Also keep non-matching serial lines as raw records")
    return parser.parse_args()


def import_serial() -> Any:
    try:
        import serial  # type: ignore
    except ImportError as exc:
        raise SystemExit("pyserial is required: python3 -m pip install pyserial") from exc
    return serial


def decode_line(line: bytes) -> str:
    return line.decode("utf-8", errors="replace").strip()


def main() -> int:
    args = parse_args()
    serial = import_serial()
    deadline = time.monotonic() + args.duration if args.duration > 0 else None
    count = 0

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with serial.Serial(args.port, args.baud, timeout=1) as ser, args.output.open("a", encoding="utf-8") as output:
        while deadline is None or time.monotonic() < deadline:
            line = decode_line(ser.readline())
            if not line:
                continue

            record: dict[str, Any] | None = None
            if line.startswith(args.prefix):
                payload = line[len(args.prefix) :]
                try:
                    record = json.loads(payload)
                except json.JSONDecodeError:
                    record = {"schema": "tg.capture_error.v1", "line": line, "error": "invalid_json"}
            elif args.raw:
                record = {"schema": "tg.serial_raw.v1", "capturedAt": time.time(), "line": line}

            if record is not None:
                record.setdefault("capturedAt", time.time())
                output.write(json.dumps(record, separators=(",", ":")) + "\n")
                output.flush()
                count += 1

    print(f"captured_records={count} output={args.output}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
