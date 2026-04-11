FROM node:20-bookworm-slim AS deps

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    pkg-config \
    libglib2.0-dev \
    libvips-dev \
 && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./

RUN npm ci

FROM node:20-bookworm-slim AS runner

LABEL org.opencontainers.image.title="VaniaBot IA"
LABEL org.opencontainers.image.authors="Carlos Garcia"
LABEL org.opencontainers.image.licenses="MIT"

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    ffmpeg \
    python3 \
    libcairo2 \
    libpango1.0-0 \
    libgif7 \
    libjpeg62-turbo \
    librsvg2-2 \
    libpng16-16 \
    libvips42 \
    libglib2.0-0 \
    fonts-noto \
    fonts-noto-color-emoji \
    tzdata \
    curl \
 && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
    -o /usr/local/bin/yt-dlp \
 && chmod a+rx /usr/local/bin/yt-dlp \
 && rm -rf /var/lib/apt/lists/*

ENV TZ=America/Mexico_City

RUN groupadd --system --gid 1001 vaniabot \
 && useradd --system --uid 1001 --gid vaniabot --create-home vaniabot \
 && mkdir -p /home/vaniabot/.cache/fontconfig /var/cache/fontconfig \
 && chown -R vaniabot:vaniabot /home/vaniabot/.cache \
 && chmod 777 /var/cache/fontconfig \
 && fc-cache -f

COPY --from=deps /app/node_modules ./node_modules
COPY tsconfig.json ./
COPY vania.ts ./
COPY src/ ./src/
COPY data/ ./data/

RUN mkdir -p vaniasession data/temp logs \
 && chown -R vaniabot:vaniabot /app

USER vaniabot

ENV NODE_ENV=production \
    AUTH_MODE=qr \
    FONTCONFIG_CACHE=/home/vaniabot/.cache/fontconfig \
    DOCKER_MODE=true \
    USE_REDIS=true \
    REDIS_HOST=vania-redis \
    REDIS_PORT=6379 \
    PATH="/app/node_modules/.bin:${PATH}"

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD pgrep -f "tsx vania.ts" > /dev/null || exit 1

CMD ["node_modules/.bin/tsx", "vania.ts", "qr"]