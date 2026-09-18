# Production image for the web client (Vite build + nginx).
# Build from the repo root so workspace paths resolve:
#   docker build -f client/Dockerfile \
#     --build-arg VITE_API_URL=https://api.example.com \
#     -t aggre-gator-web .
FROM oven/bun:1 AS build
WORKDIR /srv
ARG VITE_API_URL=http://localhost:3001
ENV VITE_API_URL=$VITE_API_URL
COPY bun.lock package.json bunfig.toml ./
COPY client/package.json ./client/
COPY shared ./shared
RUN bun install --frozen-lockfile --filter aggregator
COPY client ./client
WORKDIR /srv/client
RUN bun run build

FROM nginx:alpine AS runtime
COPY client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /srv/client/dist /usr/share/nginx/html
EXPOSE 80
