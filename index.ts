const server = require('./server');
require("dotenv").config({silent: true});

const port = process.env.PORT;

const listener = server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

const closeserver = ():void => {
    listener.close();
}

module.exports = {
    close: closeserver
}