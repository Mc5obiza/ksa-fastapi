from pydantic import BaseModel,Field

class ChatRequest(BaseModel):
    message : str = Field(...,min_length=4)

class ChatResponse(BaseModel):
    msg:str
    model : str | None = None
    tokens : int = 0

class QuizzRequest(BaseModel):
    topic:str = Field(...,min_length=3)
    number_questions : int = Field(default=3,ge=3,le=10)
    number_options : int = Field(default=4,ge=4,le=6)

class Question(BaseModel):
    question : str
    options : list[str]
    correct : int

class QuizzResponse(BaseModel):
    topic : str
    questions : list[Question]

class FlashCardRequest(BaseModel):
    topic: str = Field(...,min_length=4)
    number : int = Field(default=3,ge=3,le=10)

class FlashCard(BaseModel):
    question:str
    answer:str

class FlashCardResponse(BaseModel):
    topic : str
    flashcards : list[FlashCard]
