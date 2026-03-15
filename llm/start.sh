#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

MODEL="${LLM_MODEL:-Qwen/Qwen3.5-9B}"
PORT="${LLM_PORT:-8766}"
QUANT="${LLM_QUANTIZATION:-bitsandbytes}"
DTYPE="${LLM_DTYPE:-float16}"

echo "[LLM] Model:         $MODEL"
echo "[LLM] Port:          $PORT"
echo "[LLM] Quantization:  $QUANT"
echo "[LLM] Dtype:         $DTYPE"

exec python "$SCRIPT_DIR/server.py" \
  --model "$MODEL" \
  --port "$PORT" \
  --quantization "$QUANT" \
  --dtype "$DTYPE"
