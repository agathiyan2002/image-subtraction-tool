# Use Ubuntu 20.04 as the base image
FROM ubuntu:20.04

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=Asia/Kolkata

# Update and install necessary packages
RUN apt update && \
    apt install -y python3 python3-pip unzip libsm6 libxext6 nano systemd && \
    pip3 install --upgrade pip

# Create and set the working directory
RUN mkdir /app
WORKDIR /app

# Copy the main.zip file into the container
COPY ./main.zip /app/
RUN unzip main.zip

# Copy the run.sh script into the container and make it executable
COPY run.sh /run.sh
RUN chmod +x /run.sh

# Copy the requirements.txt and install dependencies
COPY requirements.txt /install/
RUN pip3 install -r /install/requirements.txt

# Set the entrypoint to run the run.sh script
ENTRYPOINT ["/bin/bash", "/run.sh"]
