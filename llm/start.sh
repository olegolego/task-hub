#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

MODEL="${LLM_MODEL:-Qwen/Qwen2.5-7B-Instruct}"
PORT="${LLM_PORT:-8766}"
QUANT="${LLM_QUANTIZATION:-bitsandbytes}"
DTYPE="${LLM_DTYPE:-float16}"

echo "[LLM] Model:         $MODEL"
echo "[LLM] Port:          $PORT"
echo "[LLM] Quantization:  $QUANT"
echo "[LLM] Dtype:         $DTYPE"

CONDA="$HOME/miniconda3"
# nvcc binary
export CUDA_HOME="$CONDA"
export PATH="$CONDA/bin:$CONDA/targets/x86_64-linux/bin:$PATH"
# libcudart and other CUDA runtime libs for the linker
export LIBRARY_PATH="$CONDA/lib:$CONDA/lib/python3.13/site-packages/nvidia/cuda_runtime/lib:$LIBRARY_PATH"
export LD_LIBRARY_PATH="$CONDA/lib:$LD_LIBRARY_PATH"

exec python "$SCRIPT_DIR/server.py" \
  --model "$MODEL" \
  --port "$PORT" \
  --quantization "$QUANT" \
  --dtype "$DTYPE"
