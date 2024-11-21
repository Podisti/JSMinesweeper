/**
 *   This contains the communications code
 */

//"use strict";

const http = require('http'); // Import Node.js core module
const path = require('path');
const express = require('express');
const cors = require('cors'); // Import the cors package

const { JSDOM } = require('jsdom'); // Import jsdom
const fs = require('fs');

const htmlContent = fs.readFileSync('./index.html', 'utf-8');

// Create a simulation of the DOM environment
const dom = new JSDOM(htmlContent);
// Set global variables to simulate browser-like environment
global.window = dom.window;
global.document = dom.window.document;
global.Image = dom.window.Image;

// Validation using express-validator
const { checkSchema, validationResult } = require('express-validator');
const validateDataRequest = checkSchema({
    "header.id": {
        in: ['body'],
        isInt: true,
        toInt: true,
        errorMessage: 'ID must be an integer'
    },
    "header.width": {
        in: ['body'],
        isInt: true,
        toInt: true,
        custom: {
            options: (value) => value > 0,
            errorMessage: 'Width must be a positive integer'
        }
    },
    "header.height": {
        in: ['body'],
        isInt: true,
        toInt: true,
        custom: {
            options: (value) => value > 0,
            errorMessage: 'Height must be a positive integer'
        }
    },
    "header.mines": {
        in: ['body'],
        isInt: true,
        toInt: true,
        custom: {
            options: (value, { req }) => value >= 0 && value < req.body.header.width * req.body.header.height,
            errorMessage: 'Mines count must be a non-negative integer less than width * height'
        }
    },
    "header.seed": {
        in: ['body'],
        isInt: true,
        toInt: true,
        errorMessage: 'Seed must be an integer'
    },
    "header.gametype": {
        in: ['body'],
        isString: true,
        matches: {
            options: [/^safe$/],
            errorMessage: 'Game type must "safe"'
        }
    },
    "actions": {
        in: ['body'],
        isArray: true,
        errorMessage: 'Actions must be an array'
    },
    "actions.*.index": {
        in: ['body'],
        isInt: true,
        toInt: true,
        custom: {
            options: (value, { req }) => value >= 0 && value < req.body.header.width * req.body.header.height,
            errorMessage: 'Action index must be a non-negative integer less than width * height'
        }
    },
    "actions.*.action": {
        in: ['body'],
        isInt: true,
        toInt: true,
        custom: {
            options: (value) => [1, 2, 3].includes(value),
            errorMessage: 'Action must be one of the integers: 1, 2, or 3'
        }
    }
});

// Middleware
const validateRequestMiddleware = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

require("./Minesweeper/client/Board.js");
require("./Minesweeper/client/Tile.js");
require("./Minesweeper/client/solver_main.js");
require("./Minesweeper/client/BruteForceAnalysis.js");
require("./Minesweeper/client/SolutionCounter.js");
require("./Minesweeper/client/EfficiencyHelper.js");
require("./Minesweeper/client/FiftyFiftyHelper.js");
require("./Minesweeper/client/LongTermRiskHelper.js");
require("./Minesweeper/client/main.js");
require("./Minesweeper/Utility/PrimeSieve.js");
require("./Minesweeper/Utility/Binomial.js");

// Creating a link to the minesweeper game logic (this logic is intended to be used by the server or the client)
var minesweeperLogic = require('./Minesweeper/client/MineSweeperGame');
var main = require("./Minesweeper/client/main.js");

const server = express();
server.use(cors()); // Enable CORS
server.use(express.static(path.join(__dirname, '')));
server.use(express.json());

// Setup the heart beat logic to run regularly (interval in milliseconds)
setInterval(minesweeperLogic.heartbeat, 60000);
minesweeperLogic.startup();

// Main site then sends the HTML home page
server.get('/start', function (req, res) {
    console.log("New client attaching");
    console.log('Sending web page from ' + path.join(__dirname, '.', 'index.html'));
    main.start();
    res.sendFile(path.join(__dirname, '.', 'index.html'));
});

// Request a new game ID
server.get('/requestID', function (req, res) {
    console.log('Request for game id received');
    var reply = minesweeperLogic.getNextGameID();
    console.log("==> " + JSON.stringify(reply));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.write(JSON.stringify(reply));
    res.end();
});

// Send the actions and their consequences
server.post('/kill', function (req, res) {
    console.log('Kill request received ');
    var message = req.body;
    console.log("<== " + JSON.stringify(message));
    var reply = minesweeperLogic.killGame(message);
    console.log("==> " + JSON.stringify(reply));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.write(JSON.stringify(reply));
    res.end();
});

// Send the actions and their consequences
server.post('/data', validateDataRequest, validateRequestMiddleware, async function (req, res) {
    console.log('Data request received ');
    var message = req.body;
    console.log("<== " + JSON.stringify(message));
    try {
        var reply = await minesweeperLogic.handleActions(message);
        if (reply == null) {
            console.log("No reply returned from handle actions method");
            return res.status(500).json({ error: 'Internal server error: No reply generated.' });
        }
        console.log("==> " + JSON.stringify(reply));
    } catch (e) {
        console.log('Game logic error, perhaps too many mines for too small area? error: ' + e.message + '\n' + e.stack);
        return res.status(500).json({ error: 'Internal server error: No reply generated. Maybe too many mines for too small area?' });
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.write(JSON.stringify(reply));
    res.end();
});

// Start up the server
http.createServer(server).listen(5500, function () {
    console.log('HTTP server listening on port 5500');
});
