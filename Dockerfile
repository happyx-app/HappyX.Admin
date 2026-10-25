# The build output is static files, so it is built once on the build machine's platform and
# copied into each architecture's nginx image.
FROM --platform=$BUILDPLATFORM node:26-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.31-alpine
# API_URL is the API's admin port on the stack's internal network; ADMIN_API_KEY is required.
ENV API_URL=http://api:8081
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --chmod=755 docker/05-require-admin-key.sh /docker-entrypoint.d/
COPY --from=build /src/dist /usr/share/nginx/html
EXPOSE 8080
