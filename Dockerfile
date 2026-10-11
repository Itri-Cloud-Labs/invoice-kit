# Marketing site image. Build from the repository root: the site imports the
# library's pure modules and package.json straight from packages/typescript.
FROM node:24-alpine AS build
WORKDIR /app

COPY site/package.json site/package-lock.json site/
RUN npm ci --prefix site

COPY packages/typescript/package.json packages/typescript/package.json
COPY packages/typescript/src packages/typescript/src
COPY site site
RUN npm run build --prefix site

FROM nginxinc/nginx-unprivileged:1-alpine
COPY site/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/site/dist /usr/share/nginx/html
EXPOSE 8080
