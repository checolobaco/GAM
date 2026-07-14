import os
import shutil
import uvicorn
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from audit_engine import run_audit

app = FastAPI(title="Gabinete de Auditoría Médica (GAM)")

# Ensure static folder exists
os.makedirs("static", exist_ok=True)
os.makedirs("tmp", exist_ok=True)

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
            
        # Run audit engine
        results = run_audit(pf_temp_path, hc_temp_path)
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

# Serve other static files
app.mount("/static", StaticFiles(directory="static"), name="static")

data_dir = os.getenv("DATA_DIR", "data")
os.makedirs(data_dir, exist_ok=True)
app.mount(f"/{data_dir}", StaticFiles(directory=data_dir), name="data")

if __name__ == "__main__":
    print("Iniciando servidor local en http://localhost:8000")
    uvicorn.run(app, host="127.0.0.1", port=8000)
