from fastapi import APIRouter,HTTPException
from backend.services.models import ChatRequest,ChatResponse
from backend.services.ai import get_response,AIServiceError
from backend.services.error import error_to_http
router = APIRouter(prefix="/chat",tags=["Chat"])
@router.post('/',response_model=ChatResponse)
def chat(request:ChatRequest):
    clean_msg = request.message.strip()
    if not clean_msg:
        raise HTTPException(status_code=400,detail="Message can t be empty")
    try:
        response = get_response(clean_msg)
        return ChatResponse(
            msg = response["response"],
            model=response["model"],
            tokens=response["tokens_used"]
        )
    except AIServiceError as error:
        raise error_to_http(error)
