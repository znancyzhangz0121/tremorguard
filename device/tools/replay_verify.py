#!/usr/bin/env python3
"""Replay and verify TremorGuard serial captures as 10 second ingestion windows."""

from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

SAMPLE_RATE_HZ = 100
WINDOW_SECONDS = 10
SAMPLES_PER_WINDOW = SAMPLE_RATE_HZ * WINDOW_SECONDS
SCHEMA = "tg.raw_window.v1"
FIRMWARE_VERSION = "tool-replay"


@dataclass(frozen=True)
class VerifyResult:
    windows: int
    samples: int
    warnings: list[str]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path, help="Input sample NDJSON")
    parser.add_argument("--device-id", required=True, help="Device id to include in replay batches")
    parser.add_argument("--secret", default="", help="Optional HMAC secret for signed replay")
    parser.add_argument("--endpoint", default="", help="Optional ingestion endpoint URL")
    parser.add_argument("--max-windows", type=int, default=0, help="Limit windows sent/printed; 0 means all")
    parser.add_argument("--print-batches", action="store_true", help="Print generated batch JSON to stdout")
    parser.add_argument("--strict", action="store_true", help="Fail on timing or sample-count warnings")
    return parser.parse_args()


def load_samples(path: Path) -> list[dict[str, Any]]:
    samples: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            line = line.strip()
            if not line:
                continue
            record = json.loads(line)
            if record.get("schema") in {"tg.sample.v1", "tg.sample.synthetic.v1"}:
                samples.append(normalize_sample(record, line_number))
    return samples


def normalize_sample(record: dict[str, Any], line_number: int) -> dict[str, Any]:
    required = ["tMs", "ax", "ay", "az", "gx", "gy", "gz"]
    missing = [field for field in required if field not in record]
    if missing:
        raise ValueError(f"line {line_number}: missing required sample fields: {', '.join(missing)}")

    normalized = {field: int(record[field]) for field in required}
    normalized["temp"] = int(record.get("temp", 0))
    return normalized


def chunk_windows(samples: list[dict[str, Any]]) -> Iterable[list[dict[str, Any]]]:
    for index in range(0, len(samples), SAMPLES_PER_WINDOW):
        window = samples[index : index + SAMPLES_PER_WINDOW]
        if window:
            yield window


def build_batch(device_id: str, sequence: int, samples: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "schema": SCHEMA,
        "deviceId": device_id,
        "firmwareVersion": FIRMWARE_VERSION,
        "sequence": sequence,
        "sampleRateHz": SAMPLE_RATE_HZ,
        "windowSeconds": WINDOW_SECONDS,
        "startedAtMs": samples[0]["tMs"],
        "endedAtMs": samples[-1]["tMs"],
        "sampleCount": len(samples),
        "samples": samples,
    }


def verify_batch(batch: dict[str, Any]) -> list[str]:
    warnings: list[str] = []
    if batch["sampleRateHz"] != SAMPLE_RATE_HZ:
        warnings.append(f"sequence {batch['sequence']}: sampleRateHz is not {SAMPLE_RATE_HZ}")
    if batch["sampleCount"] != SAMPLES_PER_WINDOW:
        warnings.append(f"sequence {batch['sequence']}: sampleCount={batch['sampleCount']} expected={SAMPLES_PER_WINDOW}")

    samples = batch["samples"]
    if len(samples) >= 2:
        deltas = [right["tMs"] - left["tMs"] for left, right in zip(samples, samples[1:])]
        min_delta = min(deltas)
        max_delta = max(deltas)
        if min_delta < 5 or max_delta > 20:
            warnings.append(
                f"sequence {batch['sequence']}: sample interval range {min_delta}..{max_delta} ms outside review tolerance"
            )
    return warnings


def body_bytes(batch: dict[str, Any]) -> bytes:
    return json.dumps(batch, separators=(",", ":"), sort_keys=True).encode("utf-8")


def authorization_header(device_id: str, secret: str, method: str, path: str, body: bytes) -> str:
    timestamp = str(int(time.time()))
    nonce = uuid.uuid4().hex
    body_hash = hashlib.sha256(body).hexdigest()
    signing_material = "\n".join([method, path, timestamp, nonce, body_hash]).encode("utf-8")
    signature = hmac.new(secret.encode("utf-8"), signing_material, hashlib.sha256).hexdigest()
    return f'TG-HMAC-SHA256 device="{device_id}",ts="{timestamp}",nonce="{nonce}",sig="{signature}"'


def post_batch(endpoint: str, device_id: str, secret: str, batch: dict[str, Any]) -> None:
    body = body_bytes(batch)
    path = urllib.parse.urlsplit(endpoint).path or "/"
    headers = {"Content-Type": "application/json"}
    if secret:
        headers["Authorization"] = authorization_header(device_id, secret, "POST", path, body)

    request = urllib.request.Request(endpoint, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            if response.status < 200 or response.status >= 300:
                raise RuntimeError(f"HTTP {response.status}")
    except urllib.error.URLError as exc:
        raise RuntimeError(f"failed to POST sequence {batch['sequence']}: {exc}") from exc


def replay(args: argparse.Namespace) -> VerifyResult:
    samples = load_samples(args.input)
    warnings: list[str] = []
    sent_windows = 0

    for sequence, window_samples in enumerate(chunk_windows(samples), start=1):
        if args.max_windows and sent_windows >= args.max_windows:
            break

        batch = build_batch(args.device_id, sequence, window_samples)
        warnings.extend(verify_batch(batch))

        if args.print_batches:
            print(json.dumps(batch, separators=(",", ":"), sort_keys=True))
        if args.endpoint:
            post_batch(args.endpoint, args.device_id, args.secret, batch)

        sent_windows += 1

    return VerifyResult(windows=sent_windows, samples=len(samples), warnings=warnings)


def main() -> int:
    args = parse_args()
    result = replay(args)

    for warning in result.warnings:
        print(f"warning: {warning}")

    print(f"verified_windows={result.windows} samples={result.samples} warnings={len(result.warnings)}")
    if args.strict and result.warnings:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
