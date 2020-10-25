'use strict';
const app = require('express')();
const https = require('https');
const pem = require('pem');
const path = require('path');
const express = require('express');
const mysql = require('mysql');
let io;
let sql;
let nomdutilisateur;
let activeUsers = [];

pem.createCertificate({ days: 1, selfSigned: true }, function(err, keys) {
    var options = {
        key: keys.serviceKey,
        cert: keys.certificate
    };
    const httpsServer = https.createServer(options, app);
    io = require('socket.io')(httpsServer);
    httpsServer.listen(5000);

    handleRoutes();
    handleSocketConnection();

    // Les fonctions

    function handleRoutes() {
        app.use(express.static(path.join(__dirname, "/public")));
        app.get('/all.css', function(req, res) {
            res.sendFile(__dirname + '/public/fa/css/all.css')
        });
        app.get('/bootstrap.css', function(req, res) {
            res.sendFile(__dirname + '/public/css/bootstrap/bootstrap.css')
        });
        app.get('/styles.css', function(req, res) {
            res.sendFile(__dirname + '/public/css/styles.css')
        });
        app.get('/login.css', function(req, res) {
            res.sendFile(__dirname + '/public/css/login.css')
        });
        app.get('/main.js', function(req, res) {
            res.sendFile(__dirname + '/public/scripts/main.js')
        });
        app.get('/adapter-latest.js', function(req, res) {
            res.sendFile(__dirname + '/public/scripts/adapter-latest.js')
        });
    }

    function handleSocketConnection() {
        io.on("connection", socket => {
            console.log("active users : " + activeUsers)
            const existingSocket = activeUsers.find(
                existingSocket => existingSocket === socket.id
            );

            socket.emit("update-user-list", {
                users: activeUsers.filter(
                    existingSocket => existingSocket !== socket.id
                )
            });

            socket.broadcast.emit("update-user-list", {
                users: [socket.id]
            });
            socket.emit("your-id", {
                socketId: socket.id
            });
            //general events handling
            socket.on("login", data => {
                let state;
                var con = mysql.createConnection({
                    host: "localhost",
                    user: "spartan",
                    password: "spartan8089",
                    database: "confeo"
                });

                con.connect(function(err) {
                    if (err) throw err;
                    console.log("Connected to database!");
                    let username = data.username;
                    let password = data.password;
                    sql = "SELECT * FROM users WHERE uname=" + mysql.escape(username) + "and mdp=" + mysql.escape(password);
                    con.query(sql, function(err, result) {
                        if (err) throw err;
                        let data = JSON.parse(JSON.stringify(result));
                        let count = data.length;
                        //console.log(count);
                        if (count === 1) {
                            state = true;
                            console.log("profile matched");
                            nomdutilisateur = username;
                            socket.emit("your-username", {
                                username: nomdutilisateur
                            });
                        } else {
                            state = false;
                            console.log("profile unmatched");
                        }
                        socket.emit("logging-control", {
                            state: state,
                            to: data.socket
                        });
                    });
                });
                //console.log(data.socketId);
            });
            socket.on("login-success", () => {

                if (!existingSocket) {
                    activeUsers.push(socket.id);
                    console.log(activeUsers)
                    socket.broadcast.emit("update-user-list", {
                        users: [socket.id]
                    });
                }
            })
            socket.on("disconnect", () => {
                activeUsers = activeUsers.filter(
                    existingSocket => existingSocket !== socket.id
                );
                socket.broadcast.emit("remove-user", {
                    socketId: socket.id
                });
            });
            //diffusion events
            socket.on("send-diffusion-candidate", data => {
                socket.broadcast.emit("new-diffusion-candidate", { candidate: data.candidate });
            });
            socket.on("make-diffusion-offer", data => {
                socket.broadcast.emit("diffusion-offer-made", {
                    offer: data.offer,
                    socket: socket.id
                });
            });
            socket.on("make-diffusion-answer", data => {
                socket.to(data.to).emit("diffusion-answer-made", { answer: data.answer })
            });
            //call events
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
            });
            //audio call events
            socket.on("send-audio-candidate", data => {
                socket.to(data.to).emit("new-audio-candidate", {
                    candidate: data.candidate,
                    socket: socket.id
                });
            });
            socket.on("make-audio-offer", data => {
                socket.to(data.to).emit("audio-offer-made", {
                    offer: data.offer,
                    socket: socket.id
                });
            });
            socket.on("make-audio-answer", data => {
                socket.to(data.to).emit("audio-answer-made", {
                    socket: socket.id,
                    answer: data.answer
                })
            });
            //data channel events
            socket.on("send-dc-candidate", data => {
                socket.to(data.to).emit("new-dc-candidate", {
                    candidate: data.candidate,
                    socket: socket.id
                });
            });
            socket.on("make-dc-offer", data => {
                socket.to(data.to).emit("dc-offer-made", {
                    offer: data.offer,
                    socket: socket.id
                });
            });
            socket.on("make-dc-answer", data => {
                socket.to(data.to).emit("dc-answer-made", {
                    socket: socket.id,
                    answer: data.answer
                })
            })
        });
    }
    console.log('serving on https://localhost:5000');
});