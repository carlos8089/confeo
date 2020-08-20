/*
 *  Copyright (c) 2017 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
/* eslint-env node */

'use strict';

//code initiaux



var express = require('express');
var https = require('https');
var pem = require('pem');

pem.createCertificate({ days: 1, selfSigned: true }, function(err, keys) {
    var options = {
        key: keys.serviceKey,
        cert: keys.certificate
    };
    var app = express();

    //app.use(express.static('../'));
    app.get('/', function(req, res) {
        //arrivé sur le repetoire racine du serveur, retourne le fichier index.html
        res.sendFile(__dirname + '/index.html')

    })

    app.get('/css/bootstrap.css', function(req, res) {
        //arrivé sur le repetoire racine du serveur, retourne le fichier index.html
        res.sendFile(__dirname + '/css/bootstrap.css')

    })

    app.get('/js/main.js', function(req, res) {
        //arrivé sur le repetoire racine du serveur, retourne le fichier index.html
        res.sendFile(__dirname + '/js/main.js')

    })

    app.get('/js/adapter-latest.js', function(req, res) {
        //arrivé sur le repetoire racine du serveur, retourne le fichier index.html
        res.sendFile(__dirname + '/js/adapter-latest.js')

    })

    // Create an HTTPS service.
    https.createServer(options, app).listen(8080);

    console.log('serving on https://localhost:8080');
});

/*
require('webrtc-adapter')
const app = require('express')()
const http = require('http').createServer(app)

//routes

//renvoi l'application

app.get('/', function(req, res) {
    //arrivé sur le repetoire racine du serveur, retourne le fichier index.html
    res.sendFile(__dirname + '/index.html')

})

app.get('/css/bootstrap.css', function(req, res) {
    //arrivé sur le repetoire racine du serveur, retourne le fichier index.html
    res.sendFile(__dirname + '/css/bootstrap.css')

})

app.get('/js/main.js', function(req, res) {
    //arrivé sur le repetoire racine du serveur, retourne le fichier index.html
    res.sendFile(__dirname + '/js/main.js')

})

app.get('/js/adapter.js', function(req, res) {
    //arrivé sur le repetoire racine du serveur, retourne le fichier index.html
    res.sendFile(__dirname + '/js/adapter.js')

})

//lance le serveur web et écoute l'adresse
http.listen(3000, function() {
    console.log('Serveur tournant sur 3000')

})
*/