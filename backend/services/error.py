from backend.services.ai import AIServiceError
from fastapi import HTTPException

def error_to_http(error:AIServiceError):
    if error.kind == "auth":
        return HTTPException(status_code=401,detail=error.message)
    if error.kind == "rate":
        return HTTPException(status_code=429,detail=error.message)
    return HTTPException(status_code=500,detail="Internal Server Error")