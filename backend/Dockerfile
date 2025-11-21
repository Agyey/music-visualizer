FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for librosa and audio processing
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ .

# Set PYTHONPATH to current directory
ENV PYTHONPATH=/app

# Expose port
EXPOSE 8000

# Run the application with increased limits for large file uploads
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--limit-max-requests", "1000", "--timeout-keep-alive", "300"]

