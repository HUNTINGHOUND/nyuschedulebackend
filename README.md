# Nyuschedule backend
This is the backend for the nyuschedule backend ([repo here](https://github.com/HUNTINGHOUND/nyuschedule)). The entire backend is written in typescript and using node. 
## Build yourself 
Since the server relies on `selenium`, you should use `docker` for the `albert` features. Download `docker-compose` and simply run `docker-compose up` at the root directoy. 

For the server alone, clone the repo and write a `.env` file with the `PORT` set to the port you want the server to listen to and `NODE_ENV` set to `production` if you don't want debug info to be printed to the console. Finally run the following commands in the console. Note that the server will crush almost immediately with out `selenium`. If you have standalone `selenium hub` that you want to use, add `SELENIUM_URL` to the `.env` file and set it to the url of the hub.
```
npm install
tsc
npm start
```
