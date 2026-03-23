FROM node:20-slim

# Install system dependencies for sharp (native module)
RUN apt-get update && apt-get install -y \
    libvips-dev \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install pnpm and production dependencies
RUN npm install -g pnpm@10.4.1 && \
    pnpm install --prod --ignore-scripts && \
    pnpm rebuild sharp

# Copy pre-built backend
COPY dist/index.js ./dist/index.js

# Copy any patches needed
COPY patches/ ./patches/ 2>/dev/null || true

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "dist/index.js"]
