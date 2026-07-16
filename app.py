import os
import shutil
import uvicorn
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List
from audit_engine import run_audit, extract_and_clean_pdf

app = FastAPI(title="Gabinete de Auditoría Médica (GAM)")

# Ensure static folder exists
os.makedirs("static", exist_ok=True)
os.makedirs("tmp", exist_ok=True)

# Global variables to store the last audited patient's EMR and prefactura texts
last_audit_data = {
    "pf_text": "",
    "hc_text": "",
    "patient_name": ""
}

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]

# Endpoint for the frontend
@app.get("/")
def read_index():
    return FileResponse("static/index.html")

# Audit API endpoint
@app.post("/api/audit")
async def audit_endpoint(
    prefactura: UploadFile = File(...),
    historia_clinica: UploadFile = File(...)
):
    # Save files temporarily
    pf_temp_path = f"tmp/{prefactura.filename}"
    hc_temp_path = f"tmp/{historia_clinica.filename}"
    
    try:
        with open(pf_temp_path, "wb") as f:
            shutil.copyfileobj(prefactura.file, f)
            
        with open(hc_temp_path, "wb") as f:
            shutil.copyfileobj(historia_clinica.file, f)
            
        # Extract and clean texts to persist for chat
        last_audit_data["pf_text"] = extract_and_clean_pdf(pf_temp_path)
        last_audit_data["hc_text"] = extract_and_clean_pdf(hc_temp_path)
        
        # Run audit engine
        results = run_audit(pf_temp_path, hc_temp_path)
        last_audit_data["patient_name"] = results.get("patient_name", "el paciente")
        return results
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
        
    finally:
        # Clean up temporary files
        if os.path.exists(pf_temp_path):
            os.remove(pf_temp_path)
        if os.path.exists(hc_temp_path):
            os.remove(hc_temp_path)

# Chat API endpoint
@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    gemini_key = os.environ.get("GEMINI_API_KEY")
    groq_key = os.environ.get("GROQ_API_KEY")
    
    # Check if keys are available
    if not gemini_key and not groq_key:
        raise HTTPException(
            status_code=400, 
            detail="No se han configurado llaves de API (GEMINI_API_KEY o GROQ_API_KEY) en las variables de entorno. Por favor configúralas para usar a GAMi."
        )
        
    if not last_audit_data["pf_text"] and not last_audit_data["hc_text"]:
        raise HTTPException(
            status_code=400,
            detail="No hay documentos clínicos cargados actualmente. Por favor, sube una Historia Clínica y una Prefactura e inicia la auditoría primero."
        )
        
    # Prepare system instructions
    system_prompt = (
        "Eres GAMi, la asistente de Inteligencia Artificial del Gabinete de Auditoría Médica (GAM).\n"
        "Tu trabajo es responder las preguntas del usuario sobre la historia clínica y la prefactura cargadas de forma amigable, profesional y extremadamente precisa.\n"
        "Utiliza la siguiente información de contexto para fundamentar tus respuestas:\n\n"
        f"Nombre del Paciente: {last_audit_data['patient_name']}\n\n"
        f"--- PREFACTURA DE COBRO ---\n{last_audit_data['pf_text'][:100000]}\n\n"
        f"--- HISTORIA CLINICA ---\n{last_audit_data['hc_text'][:150000]}\n\n"
        "Instrucciones de comportamiento:\n"
        "- Responde siempre en español de forma concisa, educada y fundamentada con el texto.\n"
        "- Si el usuario te pregunta algo no relacionado o fuera del contexto de esta auditoría, explícale de forma educada que solo puedes responder dudas sobre el caso médico actual del paciente."
    )
    
    import requests
    
    # Try Gemini
    if gemini_key:
        model = "gemini-3.5-flash"
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={gemini_key}"
        
        gemini_contents = []
        for m in request.messages:
            role = "user" if m.role == "user" else "model"
            gemini_contents.append({
                "role": role,
                "parts": [{"text": m.content}]
            })
        
        payload = {
            "systemInstruction": {
                "parts": [{"text": system_prompt}]
            },
            "contents": gemini_contents,
            "generationConfig": {
                "temperature": 0.3
            }
        }
        headers = {"Content-Type": "application/json"}
        try:
            response = requests.post(url, headers=headers, json=payload, timeout=120)
            if response.status_code == 200:
                res_json = response.json()
                answer = res_json["candidates"][0]["content"]["parts"][0]["text"]
                return {"answer": answer}
            else:
                print(f"Gemini chat failed: {response.text}")
        except Exception as gemini_err:
            print(f"Gemini chat error: {gemini_err}")
            
    # Try Groq (fallback)
    if groq_key:
        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {groq_key}",
            "Content-Type": "application/json"
        }
        groq_messages = [{"role": "system", "content": system_prompt}]
        for m in request.messages:
            groq_messages.append({"role": "system" if m.role == "system" else "user" if m.role == "user" else "assistant", "content": m.content})
            
        payload = {
            "model": "llama-3.3-70b-versatile",
            "messages": groq_messages,
            "temperature": 0.3
        }
        try:
            response = requests.post(url, headers=headers, json=payload, timeout=120)
            if response.status_code == 200:
                res_json = response.json()
                answer = res_json["choices"][0]["message"]["content"]
                return {"answer": answer}
        except Exception as groq_err:
            print(f"Groq chat error: {groq_err}")
            
    raise HTTPException(
        status_code=500,
        detail="Ocurrió un error al intentar comunicar con la API de Inteligencia Artificial para el chat de GAMi."
    )

# Serve other static files
app.mount("/static", StaticFiles(directory="static"), name="static")

data_dir = os.getenv("DATA_DIR", "data")
os.makedirs(data_dir, exist_ok=True)
app.mount(f"/{data_dir}", StaticFiles(directory=data_dir), name="data")

if __name__ == "__main__":
    print("Iniciando servidor local en http://localhost:8000")
    uvicorn.run(app, host="127.0.0.1", port=8000)
