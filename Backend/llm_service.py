from groq import Groq
from dotenv import load_dotenv
import os
import logging
import requests
import json

env_path = os.path.join(
    os.path.dirname(__file__),
    ".env"
)

load_dotenv(env_path)

# Groq Client Initialization (Fallback)
groq_api_key = os.getenv("GROQ_API_KEY")
client = None
if groq_api_key:
    try:
        client = Groq(api_key=groq_api_key)
    except Exception as e:
        logging.error(f"Failed to initialize Groq client: {e}")

def generate_answer(context, question):
    openrouter_api_key = os.getenv("OPENROUTER_API_KEY")
    if openrouter_api_key:
        model = os.getenv("OPENROUTER_MODEL", "google/gemini-2.5-flash")
        prompt = f"""You are an AI Research Assistant.

Answer the question using the provided context.

Context:
{context}

Question:
{question}

Instructions:
- Use the context to answer the question.
- If relevant information exists, provide a clear and concise answer.
- You may combine information from multiple context sections.
- Do not invent facts that are not supported by the context.
- Only say "I could not find the answer in the uploaded documents."
  if the context contains absolutely no relevant information.

Answer:"""
        try:
            headers = {
                "Authorization": f"Bearer {openrouter_api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://ai-research-assistant-tan.vercel.app",
                "X-Title": "ResearchAI"
            }
            payload = {
                "model": model,
                "messages": [
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.2
            }
            response = requests.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=60
            )
            if response.status_code == 200:
                return response.json()["choices"][0]["message"]["content"]
            else:
                return f"OpenRouter API Error ({response.status_code}): {response.text}"
        except Exception as e:
            return f"Failed to query OpenRouter: {e}"

    if not client:
        return "LLM service is not configured. Please set GROQ_API_KEY or OPENROUTER_API_KEY in the server environment."

    prompt = f"""
You are an AI Research Assistant.

Answer the question using the provided context.

Context:
{context}

Question:
{question}

Instructions:
- Use the context to answer the question.
- If relevant information exists, provide a clear and concise answer.
- You may combine information from multiple context sections.
- Do not invent facts that are not supported by the context.
- Only say "I could not find the answer in the uploaded documents."
  if the context contains absolutely no relevant information.

Answer:
"""

    response = client.chat.completions.create(
        model="openai/gpt-oss-20b",
        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ],
        temperature=0.2
    )

    return response.choices[0].message.content

def generate_answer_stream(context, question, persona="default"):
    openrouter_api_key = os.getenv("OPENROUTER_API_KEY")
    if openrouter_api_key:
        model = os.getenv("OPENROUTER_MODEL", "google/gemini-2.5-flash")
        
        system_instruction = "Answer the question using the provided context."
        if persona == "critique":
            system_instruction = "Analyze and critique the academic methodology, logic, and experimental design in the provided context."
        elif persona == "summary":
            system_instruction = "Provide a clear, high-level business executive summary focusing on impact, outcomes, and key takeaways."
        elif persona == "statistics":
            system_instruction = "Extract, catalog, and list all statistical data, quantitative findings, and performance metrics in the context."

        prompt = f"""You are an AI Research Assistant.
Persona instruction: {system_instruction}

Context:
{context}

Question:
{question}

Instructions:
- Use the context to answer the question.
- If relevant information exists, provide a clear and concise answer.
- You may combine information from multiple context sections.
- Do not invent facts that are not supported by the context.
- Only say "I could not find the answer in the uploaded documents."
  if the context contains absolutely no relevant information.

Answer:"""
        try:
            headers = {
                "Authorization": f"Bearer {openrouter_api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://ai-research-assistant-tan.vercel.app",
                "X-Title": "ResearchAI"
            }
            payload = {
                "model": model,
                "messages": [
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.2,
                "stream": True
            }
            response = requests.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers=headers,
                json=payload,
                stream=True,
                timeout=60
            )
            if response.status_code == 200:
                for line in response.iter_lines():
                    if line:
                        decoded_line = line.decode('utf-8')
                        if decoded_line.startswith("data: "):
                            data_str = decoded_line[6:].strip()
                            if data_str == "[DONE]":
                                break
                            try:
                                data_json = json.loads(data_str)
                                choice = data_json.get("choices", [{}])[0]
                                delta = choice.get("delta", {})
                                content = delta.get("content", "")
                                if content:
                                    yield content
                            except Exception:
                                pass
            else:
                yield f"OpenRouter API Error ({response.status_code}): {response.text}"
        except Exception as e:
            yield f"Failed to query OpenRouter stream: {e}"
        return

    if not client:
        yield "LLM service is not configured. Please set GROQ_API_KEY or OPENROUTER_API_KEY in the server environment."
        return

    # Persona customized system instruction
    system_instruction = "Answer the question using the provided context."
    if persona == "critique":
        system_instruction = "Analyze and critique the academic methodology, logic, and experimental design in the provided context."
    elif persona == "summary":
        system_instruction = "Provide a clear, high-level business executive summary focusing on impact, outcomes, and key takeaways."
    elif persona == "statistics":
        system_instruction = "Extract, catalog, and list all statistical data, quantitative findings, and performance metrics in the context."

    prompt = f"""
You are an AI Research Assistant.
Persona instruction: {system_instruction}

Context:
{context}

Question:
{question}

Instructions:
- Use the context to answer the question.
- If relevant information exists, provide a clear and concise answer.
- You may combine information from multiple context sections.
- Do not invent facts that are not supported by the context.
- Only say "I could not find the answer in the uploaded documents."
  if the context contains absolutely no relevant information.

Answer:
"""

    response = client.chat.completions.create(
        model="openai/gpt-oss-20b",
        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ],
        temperature=0.2,
        stream=True
    )

    for chunk in response:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta
