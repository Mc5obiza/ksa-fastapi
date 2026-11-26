from fastapi import APIRouter
from backend.services.models import FlashCardRequest,FlashCard,FlashCardResponse

router = APIRouter(prefix="/flashcard",tags=["Flashcard"])

@router.post("/",response_model=FlashCardResponse)
def flashcard(request:FlashCardRequest):
        return FlashCardResponse(
                topic=request.topic,
                flashcards= [FlashCard(question="dfoihdoi",answer="dfhiujhdf") for _ in range(request.number)]
        )