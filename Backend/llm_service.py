from urllib import response
from groq import Groq
from dotenv import load_dotenv
import os

env_path = os.path.join(
    os.path.dirname(__file__),
    ".env"
)

load_dotenv(env_path)

api_key = os.getenv("GROQ_API_KEY")

client = Groq(api_key=api_key)

def generate_answer(context, question):
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
