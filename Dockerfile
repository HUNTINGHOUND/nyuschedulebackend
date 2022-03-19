FROM node:16
WORKDIR /code
EXPOSE 3000
COPY . .
RUN npm install
RUN npx tsc
CMD ["npm", "start"]