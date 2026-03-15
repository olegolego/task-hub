"""
LLM Inference Server for TaskHub
Serves a Qwen model via FastAPI + vLLM for GPU-accelerated inference.

Usage:
  python server.py [--model MODEL_ID] [--port PORT] [--quantization QUANT]
"""

import argparse
import os
import logging
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

logging.basicConfig(level=logging.INFO, format="[LLM] %(levelname)s %(message)s")
log = logging.getLogger(__name__)

DEFAULT_MODEL = os.getenv("LLM_MODEL", "Qwen/Qwen3.5-9B")
DEFAULT_PORT  = int(os.getenv("LLM_PORT", "8766"))
DEFAULT_QUANT = os.getenv("LLM_QUANTIZATION", "bitsandbytes")
DEFAULT_DTYPE = os.getenv("LLM_DTYPE", "float16")


class Message(BaseModel):
    role: str
    content: str

class GenerateRequest(BaseModel):
    messages: list[Message]
    max_tokens: Optional[int] = 1024
    temperature: Optional[float] = 0.7
    top_p: Optional[float] = 0.9

class GenerateResponse(BaseModel):
    text: str
    model: str
    prompt_tokens: int
    completion_tokens: int


llm = None
tokenizer = None
model_id = DEFAULT_MODEL


def load_model(model: str, quantization: Optional[str], dtype: str):
    global llm, tokenizer, model_id
    model_id = model
    log.info(f"Loading model: {model}  quantization={quantization}  dtype={dtype}")

    try:
        from vllm import LLM, SamplingParams  # noqa: F401
        kwargs = dict(
            model=model,
            dtype=dtype,
            gpu_memory_utilization=0.92,
            max_model_len=8192,
            trust_remote_code=True,
        )
        if quantization and quantization.lower() != "none":
            kwargs["quantization"] = quantization
        llm = LLM(**kwargs)
        log.info("Model loaded via vLLM")
    except Exception as e:
        log.warning(f"vLLM failed ({e}), falling back to transformers + bitsandbytes 4-bit")
        _load_transformers(model)


def _load_transformers(model: str):
    global llm, tokenizer
    import torch
    from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig

    bnb = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_compute_dtype=torch.float16,
        bnb_4bit_use_double_quant=True,
        bnb_4bit_quant_type="nf4",
    )
    tokenizer = AutoTokenizer.from_pretrained(model, trust_remote_code=True)
    llm = AutoModelForCausalLM.from_pretrained(
        model, quantization_config=bnb, device_map="auto", trust_remote_code=True
    )
    llm.eval()
    log.info("Model loaded via transformers (4-bit)")


def _generate_vllm(messages, max_tokens, temperature, top_p):
    from vllm import SamplingParams
    sampling = SamplingParams(max_tokens=max_tokens, temperature=temperature, top_p=top_p)
    conversation = [{"role": m.role, "content": m.content} for m in messages]
    outputs = llm.chat(conversation, sampling_params=sampling)
    out = outputs[0]
    return out.outputs[0].text, len(out.prompt_token_ids), len(out.outputs[0].token_ids)


def _generate_transformers(messages, max_tokens, temperature, top_p):
    import torch
    # Use tokenizer's chat template if available
    conversation = [{"role": m.role, "content": m.content} for m in messages]
    try:
        prompt = tokenizer.apply_chat_template(conversation, tokenize=False, add_generation_prompt=True)
    except Exception:
        # Fallback plain format
        parts = [f"<|{m.role}|>\n{m.content}" for m in messages]
        prompt = "\n".join(parts) + "\n<|assistant|>\n"

    inputs = tokenizer(prompt, return_tensors="pt").to(llm.device)
    n_prompt = inputs["input_ids"].shape[-1]
    with torch.no_grad():
        out_ids = llm.generate(
            **inputs,
            max_new_tokens=max_tokens,
            temperature=temperature,
            top_p=top_p,
            do_sample=temperature > 0,
            pad_token_id=tokenizer.eos_token_id,
        )
    new_ids = out_ids[0][n_prompt:]
    return tokenizer.decode(new_ids, skip_special_tokens=True), n_prompt, len(new_ids)


def generate(req: GenerateRequest):
    if llm is None:
        raise RuntimeError("Model not loaded")
    try:
        from vllm import LLM
        if isinstance(llm, LLM):
            return _generate_vllm(req.messages, req.max_tokens, req.temperature, req.top_p)
    except ImportError:
        pass
    return _generate_transformers(req.messages, req.max_tokens, req.temperature, req.top_p)


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield

app = FastAPI(title="TaskHub LLM Server", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/health")
def health():
    return {"status": "ok" if llm is not None else "loading", "model": model_id}


@app.post("/generate", response_model=GenerateResponse)
def generate_endpoint(req: GenerateRequest):
    if llm is None:
        raise HTTPException(503, "Model not loaded yet")
    try:
        text, prompt_tokens, completion_tokens = generate(req)
        return GenerateResponse(text=text, model=model_id,
                                prompt_tokens=prompt_tokens, completion_tokens=completion_tokens)
    except Exception as e:
        log.error(f"Generation error: {e}")
        raise HTTPException(500, str(e))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--model",        default=DEFAULT_MODEL)
    parser.add_argument("--port",         type=int, default=DEFAULT_PORT)
    parser.add_argument("--quantization", default=DEFAULT_QUANT)
    parser.add_argument("--dtype",        default=DEFAULT_DTYPE)
    args = parser.parse_args()

    quant = None if args.quantization.lower() == "none" else args.quantization
    load_model(args.model, quant, args.dtype)

    log.info(f"Starting server on port {args.port}")
    uvicorn.run(app, host="0.0.0.0", port=args.port, log_level="warning")
