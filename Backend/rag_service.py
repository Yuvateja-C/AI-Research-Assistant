from groq import Groq

client = Groq(
    api_key="YOUR_GROQ_API_KEY"
)

def generate_answer(context, question):

    prompt = f"""
    Use the context below to answer the question.

    Context:
    {context}

    Question:
    {question}

    Answer:
    """

    response = client.chat.completions.create(
        model="llama3-8b-8192",
        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ]
    )

    return response.choices[0].message.content