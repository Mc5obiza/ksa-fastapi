from .ai import get_client,AIServiceError
from openai import RateLimitError,AuthenticationError
from .models import QuizzResponse


def get_quizz(subject,number_questions,number_options):
    client = get_client()
    try:
        SYSTEM_PROMPT = f"""
                You are a quiz generator.
        Generate multiple-choice quiz questions.fr
        Each question must have exactly {number_options} options and exactly one correct answer.
        Make the questions relevant to the requested topic and factually accurate"""
        user_message = f"Generate {number_questions} questions about {subject}"
        response = client.beta.chat.completions.parse(
            model= "nvidia/nemotron-3.5-super-vl-120b-a12b",
            messages= [
                {
                    "role":"system",
                    "content":SYSTEM_PROMPT
                },
                {
                    "role":"user",
                    "content":user_message
                }
            ],
            response_format=QuizzResponse
        )
        return response.choices[0].message.parsed
    except RateLimitError:
        raise AIServiceError(kind="rate",message="Too many Requests try later")
    except AuthenticationError:
        raise AIServiceError(kind="auth",message="not Authenticated")