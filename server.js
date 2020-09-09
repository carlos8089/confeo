'use strict';

//code initiaux

const app = require('express')();
const https = require('https');
const pem = require('pem');
const path = require('path');
const express = require('express');
let io;



pem.createCertificate({ days: 1, selfSigned: true }, function(err, keys) {
    var options = {
        key: keys.serviceKey,
        cert: keys.certificate
    };

    // Create an HTTPS service.
    //https.createServer(options, app).listen(8080);
    const httpsServer = https.createServer(options, app);
    io = require('socket.io')(httpsServer);
    httpsServer.listen(5000);

    handleRoutes();
    handleSocketConnection();

    // Les fonctions

    function handleRoutes() {
        app.use(express.static(path.join(__dirname, "/public")));

        app.get('/bootstrap.css', function(req, res) {
            //arrivé sur le repetoire racine du serveur, retourne le fichier index.html
            res.sendFile(__dirname + '/public/css/bootstrap/bootstrap.css')

        })

        app.get('/styles.css', function(req, res) {
            //arrivé sur le repetoire racine du serveur, retourne le fichier index.html
            res.sendFile(__dirname + '/public/css/styles.css')

        })

        app.get('/main.js', function(req, res) {
            //arrivé sur le repetoire racine du serveur, retourne le fichier index.html
            res.sendFile(__dirname + '/public/scripts/main.js')

        })

        app.get('/adapter-latest.js', function(req, res) {
            //arrivé sur le repetoire racine du serveur, retourne le fichier index.html
            res.sendFile(__dirname + '/public/scripts/adapter-latest.js')

        })
    }

    function handleSocketConnection() {
        var activeSockets = [];

        io.on("connection", socket => {
            //console.log('new connected user :' + socket.id)
            const existingSocket = activeSockets.find(
                existingSocket => existingSocket === socket.id
            );

            if (!existingSocket) {
                activeSockets.push(socket.id);

                socket.emit("update-user-list", {
                    users: activeSockets.filter(
                        existingSocket => existingSocket !== socket.id
                    )
                });

                socket.broadcast.emit("update-user-list", {
                    users: [socket.id]
                });
            }

            socket.on("send-candidate", data => {
                socket.to(data.to).emit("new-candidate", {
                    candidate: data.candidate,
                    socket: socket.id
                });
            });

            socket.on("make-offer", data => {
                socket.to(data.to).emit("offer-made", {
                    offer: data.offer,
                    socket: socket.id
                });
            });

            socket.on("make-answer", data => {
                socket.to(data.to).emit("answer-made", {
                    socket: socket.id,
                    answer: data.answer
                })
            })

            socket.on("disconnect", () => {
                activeSockets = activeSockets.filter(
                    existingSocket => existingSocket !== socket.id
                );
                socket.broadcast.emit("remove-user", {
                    socketId: socket.id
                });
            });
        });
    }

    console.log('serving on https://localhost:5000');
});

/*
require('webrtc-adapter')
const app = require('app')()
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