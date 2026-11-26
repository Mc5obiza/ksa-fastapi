from fastapi import APIRouter,HTTPException
from backend.services.models import QuizzRequest, QuizzResponse,Question
from backend.services.ai import AIServiceError
from backend.services.error import error_to_http
from backend.services.quizz import get_quizz
router = APIRouter(prefix="/quizz",tags=["Quizz"])

@router.post('/',response_model=QuizzResponse)
def quizz(request:QuizzRequest):
    topic = request.topic.strip()
    if not topic:
        raise HTTPException(status_code=400,detail="Topic can not be empty")
    try:
        response = get_quizz(topic,request.number_questions,request.number_options)
        return response
    except AIServiceError as error:
        raise error_to_http(error)
    