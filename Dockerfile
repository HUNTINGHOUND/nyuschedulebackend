FROM node:16
WORKDIR /code
EXPOSE 80
COPY . .
RUN npm install
RUN npx tsc
CMD ["npm", "start"]