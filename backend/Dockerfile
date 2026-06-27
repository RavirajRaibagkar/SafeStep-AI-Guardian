FROM python:3.11-slim

WORKDIR /app

# Install system deps
RUN apt-get update && apt-get install -y \
    libpq-dev gcc curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Create upload directories
RUN mkdir -p uploads/audio uploads/fir uploads/evidence reports/monthly ml/data

# Generate sample crime data
RUN python ml/generate_data.py

EXPOSE 5000

CMD ["python", "run.py"]
