FROM node:20-slim

# Install FFmpeg (crucial for video project)
RUN apt-get update && apt-get install -y ffmpeg python3 python3-pip && rm -rf /var/lib/apt/lists/*

# Install yt-dlp
RUN pip3 install yt-dlp --break-system-packages

WORKDIR /app

# Copy package files and install
COPY package*.json ./
RUN npm install

# Copy rest of the code
COPY . .

# IMPORTANT: Hugging Face/Railway uses port 7860 or PORT env
ENV PORT=7860
EXPOSE 7860

# Start the server
CMD ["node", "server.js"]
