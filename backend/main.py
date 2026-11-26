import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.routers import flashcard, quizz
from backend.routers import chat

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5500,http://127.0.0.1:5500",
        ).split(",")
        if origin.strip()
    ],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)
app.include_router(flashcard.router)
app.include_router(quizz.router)
app.include_router(chat.router)
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



