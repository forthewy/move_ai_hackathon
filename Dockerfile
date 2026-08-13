FROM node:20-bookworm-slim

# Python 설치
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-pip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Node 의존성
COPY package.json package-lock.json ./
RUN npm ci

# Python 의존성
COPY requirements.txt ./
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt

# 프로젝트 복사
COPY . .

# React + Node 서버 빌드
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "start"]