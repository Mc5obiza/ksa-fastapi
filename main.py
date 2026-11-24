from fastapi import FastAPI
from pydantic import BaseModel

class ChatRequest(BaseModel):
    message : str

app = FastAPI()

@app.get("/")
def test():
    return {"message": "Welcome to the AI Student Assistant API"}
@app.get("/about")
def about():
    return {
        "project":"AI STUDENT ASSISTANT",
        "purpose":"Help students",
        "status":"Learning backend fundamentals"
    }
@app.get("/health")
def health():
    return {"status":"ok"}
@app.post("/chat")
def chat(request:ChatRequest):
    return {
       "answer": f"You asked: {request.message}",
"model": "placeholder",
"tokens_used": 0
    }