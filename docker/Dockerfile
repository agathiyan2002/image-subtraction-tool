FROM python:3

WORKDIR /app

COPY main.py /app  # Assuming main.py is in the same directory as Dockerfile

RUN pip install Flask==2.0.1 psycopg2==2.9.1 schedule==1.1.0 

# Set the execute permission for the run.sh script
RUN chmod +x /app/run.sh

CMD ["sh", "/app/run.sh"]
