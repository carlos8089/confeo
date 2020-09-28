var loginBtn = document.getElementById('loginBtn');
var valid = false;

const socket = io();

loginBtn.addEventListener('click', function() {
    var identifier = document.getElementById('identifier').value;
    var mdp = document.getElementById('mdp').value;

    socket.emit("login", {
        username: identifier,
        password: mdp,
        socketId: socket.id
    });
});

function authentify(state) {
    if (state == true) {
        console.log('authentification réussie');
        socket.emit("login-success");
        window.location.replace('app.html');
    } else {
        console.log('echec d\'authentification utilisateur');
        debugger
        window.location.reload();
    }
}

//handle socket events
socket.on("logging-control", data => {
    valid = data.state;
    authentify(valid);
});
socket.on("your-id", data => {
    console.log(data.user)
})