import express from 'express';
import cors from 'cors';
import errorHandler from 'errorhandler';

const isProduction:boolean = process.env.NODE_ENV === 'production'

const app = express();

app.use(cors());
app.use(express.json());

if (!isProduction) {
    app.use(require('morgan')('dev'))
    app.use(errorHandler());
}

app.use(require('./route'))

module.exports = app
