from ollama import chat

response = chat(
    model='qwen3.5:cloud',
    messages=[{'role': 'user', 'content': 'Hello!'}],
)
print(response.message.content)
