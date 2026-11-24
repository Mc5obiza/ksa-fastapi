from fastapi import FastAPI
from pydantic import BaseModel

class ChatRequest(BaseModel):
    message : str
class QuizzRequest(BaseModel):
    topic:str
    number_questions : int
    number_options : int
class FlashCardRequest(BaseModel):
    topic: str
    number : int

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
@app.post("/quizz")
def quizz(request:QuizzRequest):
    topic = request.topic.strip()
    questions = []
    for i in range(request.number_questions):
        questions.append(
            {
                "question":"Question"+str(i),
                "options":[f"Option {i}" for i in range(request.number_options)],
                "correct":"A"
            }
        )
    return {
        "topic":request.topic,
        "questions":questions
    }
@app.post("/flashcard")
def flashcard(request:FlashCardRequest):
        return {
            "topic":request.topic,
            "flashcard": [{"front":"GBSHDG","back":"dfuihdfui"} for _ in range(request.number)]
        }