FROM node:lts-alpine

LABEL description="Does some stuff"

WORKDIR /code

ENV NODE_ENV="production"

# Then copy code in
COPY ./commands/ /code
