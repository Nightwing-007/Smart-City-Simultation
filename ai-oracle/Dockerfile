FROM python:3.10-slim
WORKDIR /app
# Since context is root (.)
COPY ai-oracle/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY frontend/src/data/mockRoads.json ./mockRoads.json
COPY ai-oracle/ .
RUN python generate_data.py && python train_model.py
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
