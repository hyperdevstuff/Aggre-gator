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
# Fail the image build on a broken config rather than at container start. The
# crawler-routing `map` + `if`/`proxy_pass` block in nginx.conf is the kind of
# thing nginx accepts at runtime and rejects loudly in some versions.
#
# `upstream aggregator_api` points at `api:3001`, a docker-compose service name
# that only exists while the stack runs, and nginx resolves upstream names while
# parsing the config — so a plain `docker build` has no such host and the check
# could not pass. (That made the `images` CI job red on every push, `main`
# included.) `/etc/hosts` is read-only during a build, so instead this validates
# a copy with the address pointed at loopback: only the host:port changes, every
# directive that can actually be malformed is parsed exactly as shipped, and the
# real config is put back before the layer is committed.
RUN cp /etc/nginx/conf.d/default.conf /tmp/shipped.conf \
 && sed 's/api:3001/127.0.0.1:3001/' /tmp/shipped.conf > /etc/nginx/conf.d/default.conf \
 && nginx -t \
 && cp /tmp/shipped.conf /etc/nginx/conf.d/default.conf \
 && rm /tmp/shipped.conf
EXPOSE 80
