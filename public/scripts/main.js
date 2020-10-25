let username;
const app = document.getElementById('main');
const callButton = document.getElementById('call-button');
const videoCallButton = document.getElementById('video-call-button');
const msgZone = document.getElementById('message-zone');
const messages = document.getElementById('messages');
const msgSendZone = document.getElementById('send-message');
const msg = document.getElementById('msg');
const fileButton = document.getElementById('file-input');
const inputf = document.getElementById('inputf');
const msgButton = document.getElementById('msgButton');
const accueil = document.getElementById('accueil');
const diffusion = document.getElementById('diffusion');
const diff = document.getElementById('diff');
const screen = document.getElementById('screen-share');
const start = document.getElementById('start');
const action = document.getElementById('action-zone');
const video = document.getElementById('video-chat-zone');
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
var constraints = {
    audio: 0,
    video: 1
};
const offerOptions = {
    offerToReceiveAudio: 1,
    offerToReceiveVideo: 1
}; //parametrer l'offre pour l'appel
const sdpConstraints = {
    'mandatory': {
        'OfferToReceiveAudio': false,
        'OfferToReceiveVideo': false
    }
}; //paramétrer l'ofrre de RTCDataChannel
const dataChannelOptions = { ordered: true, reliable: false }; //paramétrer le DataChannel
const iceConfig = { iceServers: [] }; //configuration des serveurs ICE, STUN et TURN
const connection = {
    'optional': [{ 'DtlsSrtpKeyAgreement': true }, { 'RtpDataChannels': true }]
}; //parametrer la connection au DataChannel
let peerConnection = new RTCPeerConnection(iceConfig);
let isConnectedToSocket = false; //indique si la pair local est connected à la pair distante
let isDataChannel = false; //indique que la Datachannel est crée
let mySocketId;
let connectToSocket; //indique le socket auquel on veut se connecter
let connectedToSocket; //indique le socket auquel on est connecté
let dataChannel;
let dataType = 'text';
let receivedChannel;
let messageNumber = 0;
let readyState;
let offer;
let answer;
let stream;
let mediaSource = 'user';
let us;

//Connexion à l'application
const loginForm = document.getElementById('login-form');
var loginBtn = document.getElementById('loginBtn');
var valid = false;

loginBtn.addEventListener('click', function() {
    var identifier = document.getElementById('identifier').value;
    var mdp = document.getElementById('mdp').value;

    socket.emit("login", {
        username: identifier,
        password: mdp,
        socketId: socket.id
    });
});

//Application
//operations
function sendData(type) {
    switch (type) {
        case 'text':
            const data = msg.value;
            dataChannel.send(data);
            afficheMessage(mySocketId, data);
            console.log('Sent Data: ' + data);
            msg.value = '';
            break;

        case 'file':
            const file = inputf.files[0];
            console.log(`File is ${[file.name, file.size, file.type, file.lastModified].join(' ')}`);

            // Handle 0 size files.

            /*
            statusMessage.textContent = '';
            downloadAnchor.textContent = '';
            */
            if (file.size === 0) {
                bitrateDiv.innerHTML = '';
                statusMessage.textContent = 'File is empty, please select a non-empty file';
                closeDataChannels();
                return;
            }
            const chunkSize = 16384;
            fileReader = new FileReader();
            let offset = 0;
            fileReader.addEventListener('error', error => console.error('Error reading file:', error));
            fileReader.addEventListener('abort', event => console.log('File reading aborted:', event));
            fileReader.addEventListener('load', e => {
                console.log('FileRead.onload ', e);
                dataChannel.send(e.target.result);
                afficheFichier(mySocketId, file);
                offset += e.target.result.byteLength;
                sendProgress.value = offset;
                if (offset < file.size) {
                    readSlice(offset);
                }
            });
            const readSlice = o => {
                console.log('readSlice ', o);
                const slice = file.slice(offset, o + chunkSize);
                fileReader.readAsArrayBuffer(slice);
            };
            readSlice(0);
            console.log('Sent Data: ' + file);
            msg.value = '';

            break;
        default:
            break;
    }
}

async function gotStream() {
    try {
        switch (mediaSource) {
            case 'screen':
                stream = await navigator.mediaDevices.getDisplayMedia();
            case 'user':
                stream = await navigator.mediaDevices.getUserMedia(constraints);
            default:
                break;
        }
        console.log('Accès au flux media');
        for (const track of stream.getTracks()) {
            peerConnection.addTrack(track, stream);
        };
        localVideo.srcObject = stream;
        localVideo.play();
    } catch (error) {
        handleError(error);
    }
}
async function ecrire(socketId) {
    //send ice candidate
    peerConnection.addEventListener('icecandidate', e => onDataIceCandidate(peerConnection, socketId, e));
    peerConnection.addEventListener('iceconnectionstatechange', e => onIceStateChange(peerConnection, e));
    //canaux de données
    //create datachannel
    dataChannel = peerConnection.createDataChannel('dataChannel', dataChannelOptions);
    isDataChannel = true;
    console.log("new send data channel created ! Waiting for events")
        //datachannel event handling
    dataChannel.onmessage = function(e) {
        if (isConnectedToSocket) {
            document.getElementById('messages').appendChild(document.createElement('div').setAttribute("class", "panel").innerHTML = e.data)
        } else {
            alert(socketId + " : " + e.data)
        }
    };
    dataChannel.onopen = onSendChannelStateChange
    dataChannel.onclose = onSendChannelStateChange
    dataChannel.onerror = function() { console.log("DC ERROR!!!") };

    try {
        // create offer, set local description and send it
        offer = await peerConnection.createOffer(sdpConstraints)
        console.log("offer created: " + offer)
        await onCreateOfferSuccess(offer)
        socket.emit("make-dc-offer", {
            offer,
            to: socketId
        });
    } catch (error) {
        handleError(error)
    }
}
async function call(socketId) {
    //recuperer le flux
    gotStream();
    //send candidate to other peer
    peerConnection.addEventListener('icecandidate', e => onIceCandidate(peerConnection, socketId, e));
    peerConnection.addEventListener('iceconnectionstatechange', e => onIceStateChange(peerConnection, e));

    msgZone.removeAttribute('class', 'message-flow');
    msgZone.setAttribute('class', 'message-flow-call');
    video.hidden = false;
    // create offer, set local description and offer
    offer = await peerConnection.createOffer(offerOptions)
    await onCreateOfferSuccess(offer)
    socket.emit("make-offer", {
        offer,
        to: socketId
    });
}
async function audioCall(socketId) {
    constraints = {
        audio: 1,
        video: 0
    };
    //recuperer le flux
    gotStream();
    //send candidate to other peer
    peerConnection.addEventListener('icecandidate', e => onIceCandidate(peerConnection, socketId, e));
    peerConnection.addEventListener('iceconnectionstatechange', e => onIceStateChange(peerConnection, e));

    msgZone.removeAttribute('class', 'message-flow');
    msgZone.setAttribute('class', 'message-flow-call');
    video.hidden = false;
    // create offer, set local description and offer
    offer = await peerConnection.createOffer(offerOptions)
    await onCreateOfferSuccess(offer)
    socket.emit("make-audio-offer", {
        offer,
        to: socketId
    });
}

async function connecter(socketId) {
    header.hidden = false;
    accueil.hidden = true;
    const talkingWithInfo = document.getElementById("talking-with-info");
    talkingWithInfo.innerHTML = `${socketId}`;
    //afficher les appels à action
    action.hidden = false;
    msgSendZone.hidden = false;
    msgZone.hidden = false;
    //indiquer le socket auquel l'utilisateur se connecte
    connectToSocket = socketId;

}
async function diffuser() {
    //recuperer le flux
    gotStream(mediaSource);
    //send ice candidate
    peerConnection.addEventListener('icecandidate', e => onIceCandidate(peerConnection, e));
    peerConnection.addEventListener('iceconnectionstatechange', e => onIceStateChange(peerConnection, e));
    // create offer, set local description and offer
    offer = await peerConnection.createOffer(offerOptions)
    await onCreateOfferSuccess(offer)
    socket.emit("make-diffusion-offer", { offer });
}
msg.addEventListener('click', function() {
    dataType = 'text';
    ecrire(connectToSocket);
})
fileButton.addEventListener('click', function() {
    dataType = 'file';
    inputf.click();
});
inputf.addEventListener('change', handleFileInputChange, false);
screen.addEventListener("click", function() {
    constraints = {
        audio: 1,
        video: 1,
    }
    mediaSource = 'screen';
    call(connectToSocket);
    callButton.innerHTML = 'Revenir à la caméra';
})
callButton.addEventListener("click", function() {
    audioCall(connectToSocket);
});
videoCallButton.addEventListener("click", function() {
    constraints = {
        audio: 1,
        video: 1
    };
    call(connectToSocket);
})
msgButton.addEventListener("click", function() {
    sendData(dataType);
})
diffusion.addEventListener("click", function() {
    diffuser()
    diffusion.disabled = true
    remoteVideo.hidden = true
})
peerConnection.ontrack = ({ track, streams }) => {
    // once media for a remote track arrives, show it in the remote video element
    track.onunmute = () => {
        // don't set srcObject again if it is already set.
        if (remoteVideo.srcObject) return;
        remoteVideo.srcObject = streams[0];
    };
};
peerConnection.addEventListener('datachannel', event => {
    receivedChannel = event.channel
    receivedChannel.onmessage = onReceiveMessageCallback
    receivedChannel.onopen = onReceiveChannelStateChange
    receivedChannel.onclose = onReceiveChannelStateChange
});

//handling socket event
const socket = io();
//login events
socket.on("logging-control", data => {
    valid = data.state;
    authentify(valid);
});
socket.on("your-id", data => {
    console.log(data.user)
    mySocketId = data.socketId;

});
//diffusion events
socket.on("new-diffusion-candidate", async data => {
    console.log("new diffusion candidate received")
    try {
        peerConnection.addIceCandidate(data.candidate)
        peerConnection.addEventListener('iceconnectionstatechange', e => onIceStateChange(peerConnection, e))
    } catch (error) {
        handleError(error)
    }
});
socket.on("diffusion-offer-made", async data => {
    accueil.hidden = true;
    console.log("diffusion offer received")
    remoteVideo.hidden = false
    diff.hidden = true
    console.log("setRemoteDescription start")
    await peerConnection.setRemoteDescription(data.offer)
    await onSetRemoteSuccess(peerConnection)
        //create and send diffusion sdp answer
    try {
        console.log("peer createAnswer start")
        answer = await peerConnection.createAnswer()
        await onCreateAnswerSuccess(answer)
        socket.emit("make-diffusion-answer", { answer, to: data.socket });
    } catch (error) {
        handleError(error)
    }
});
socket.on("diffusion-answer-made", async data => {
    console.log('local peer setRemoteDescription start');
    try {
        await peerConnection.setRemoteDescription(data.answer);
        onSetRemoteSuccess(peerConnection);
    } catch (e) {
        onSetSessionDescriptionError(e);
    }
});
//call events
socket.on("new-candidate", async data => {
    console.log("new candidate received")
    try {
        peerConnection.addIceCandidate(data.candidate)
        peerConnection.addEventListener('iceconnectionstatechange', e => onIceStateChange(peerConnection, e))
    } catch (error) {
        handleError(error)
    }
});
socket.on("offer-made", async data => {
    accueil.hidden = true;
    header.hidden = false;
    msgZone.hidden = false;
    action.hidden = false;
    msgSendZone.hidden = false;
    console.log("call offer received")
    connectedToSocket = data.socket;
    video.hidden = false;
    console.log("setRemoteDescription start")
    await peerConnection.setRemoteDescription(data.offer);
    await onSetRemoteSuccess(peerConnection);
    //create and send answer
    try {
        console.log("peer createAnswer start")
        answer = await peerConnection.createAnswer()
        await onCreateAnswerSuccess(answer)
        socket.emit("make-answer", {
            answer,
            to: connectedToSocket
        });
    } catch (error) {
        handleError(error)
    }

    //emettre aussi un appel
    try {
        call(data.socket)
    } catch (error) {
        handleError(error)
    }

});
socket.on("answer-made", async data => {
    console.log('local peer setRemoteDescription start');
    try {
        await peerConnection.setRemoteDescription(data.answer);
        onSetRemoteSuccess(peerConnection);
    } catch (e) {
        onSetSessionDescriptionError(e);
    }
});
//audio call events
socket.on("new-audio-candidate", async data => {
    console.log("new candidate received")
    try {
        peerConnection.addIceCandidate(data.candidate)
        peerConnection.addEventListener('iceconnectionstatechange', e => onIceStateChange(peerConnection, e))
    } catch (error) {
        handleError(error)
    }
});
socket.on("audio-offer-made", async data => {
    accueil.hidden = true;
    header.hidden = false;
    msgZone.hidden = false;
    action.hidden = false;
    msgSendZone.hidden = false;
    console.log("audio call offer received")
    connectedToSocket = data.socket;
    video.hidden = false;
    console.log("setRemoteDescription start")
    await peerConnection.setRemoteDescription(data.offer);
    await onSetRemoteSuccess(peerConnection);
    //create and send answer
    try {
        console.log("peer createAnswer start")
        answer = await peerConnection.createAnswer()
        await onCreateAnswerSuccess(answer)
        socket.emit("make-audio-answer", {
            answer,
            to: connectedToSocket
        });
    } catch (error) {
        handleError(error)
    }

    //emettre aussi un appel
    try {
        audioCall(data.socket)
    } catch (error) {
        handleError(error);
    }
});
socket.on("audio-answer-made", async data => {
    console.log('local peer setRemoteDescription start');
    try {
        await peerConnection.setRemoteDescription(data.answer);
        onSetRemoteSuccess(peerConnection);
    } catch (e) {
        onSetSessionDescriptionError(e);
    }
});

//data channel events
socket.on("new-dc-candidate", async data => {
    console.log("new data channel candidate received");
    try {
        peerConnection.addIceCandidate(data.candidate);
        peerConnection.addEventListener('iceconnectionstatechange', e => onIceStateChange(peerConnection, e));
    } catch (error) {
        handleError(error);
    }
});
socket.on("dc-offer-made", async data => {

    console.log("datachannel offer received");
    connectedToSocket = data.socket;
    console.log("setRemoteDescription start")
    await peerConnection.setRemoteDescription(data.offer)
    await onSetRemoteSuccess(peerConnection)
    try {
        console.log("peer createAnswer start")
        answer = await peerConnection.createAnswer()
        await onCreateAnswerSuccess(answer)
        socket.emit("make-dc-answer", {
            answer,
            to: connectedToSocket
        });
    } catch (error) {
        handleError(error)
    }
    /*
    if (confirmDataChannel) {
        //console.log("new peer created");
        //peerConnection = new RTCPeerConnection(iceConfig, connection);
        console.log("setRemoteDescription start")
        await peerConnection.setRemoteDescription(data.offer)
        await onSetRemoteSuccess(peerConnection)
        try {
            console.log("peer createAnswer start")
            answer = await peerConnection.createAnswer()
            await onCreateAnswerSuccess(answer)
            socket.emit("make-dc-answer", {
                answer,
                to: data.socket
            });
        } catch (error) {
            handleError(error)
        }
        //isDataChannel = true
    } else {
        console.log(`Data channel form \n${data.socket} request rejected`);
        return;
    }
    */
});
socket.on("dc-answer-made", async data => {
    console.log('local peer setRemoteDescription start');
    try {
        await peerConnection.setRemoteDescription(data.answer);
        onSetRemoteSuccess(peerConnection);
    } catch (e) {
        onSetSessionDescriptionError(e);
    }
});
//general events handling
socket.on("your-username", data => {
    username = data.username;
});
socket.on("update-user-list", ({ users }) => {
    us = users;
    console.log("utilisateurs : " + us);
    updateUserList(users);
});
socket.on("remove-user", ({ socketId }) => {
    const elToRemove = document.getElementById(socketId);
    if (elToRemove) {
        elToRemove.remove();
    }
});

//methods definitions
function authentify(state) {
    if (state == true) {
        console.log('authentification réussie');
        socket.emit("login-success");
        loginForm.hidden = true;
        app.hidden = false;
    } else {
        console.log('echec d\'authentification utilisateur');
        debugger
        //window.location.reload();
    }
}

function unselectUsersFromList() {
    const alreadySelectedUser = document.querySelectorAll(
        ".active-user.active-user--selected"
    );

    alreadySelectedUser.forEach(el => {
        el.setAttribute("class", "active-user");
    });
};

function updateUserList(users) {
    const activeUserContainer = document.getElementById("active-user-container");

    users.forEach(user => {
        const alreadyExistingUser = document.getElementById(user);
        console.log(!alreadyExistingUser);
        if (!alreadyExistingUser) {
            const userContainerEl = createUserItemContainer(user);
            activeUserContainer.appendChild(userContainerEl);
        }
    });
};

function createUserItemContainer(socketId) {
    const userContainerEl = document.createElement("div");

    const usernameEl = document.createElement("p");

    userContainerEl.setAttribute("class", "active-user");
    userContainerEl.setAttribute("id", socketId);
    usernameEl.setAttribute("class", "username");
    usernameEl.innerHTML = `${socketId}`;
    //usernameEl.innerHTML = username;

    userContainerEl.appendChild(usernameEl);

    userContainerEl.addEventListener("click", () => {
        diffusion.disabled = true
        diffusion.setAttribute("class", "hidden")
        unselectUsersFromList();
        userContainerEl.setAttribute("class", "active-user active-user--selected");
        connecter(socketId);
    });
    return userContainerEl;
};
async function onCreateOfferSuccess(desc) {
    console.log(`Offer from local peer\n${desc.sdp}`);
    console.log('local peer setLocalDescription start');
    try {
        await peerConnection.setLocalDescription(desc);
        onSetLocalSuccess(peerConnection);
    } catch (e) {
        onSetSessionDescriptionError(e);
    }
};
async function onCreateAnswerSuccess(desc) {
    console.log(`Answer from remote peer end point:\n${desc.sdp}`);
    console.log('remote peer setLocalDescription start');
    try {
        await peerConnection.setLocalDescription(desc);
        onSetLocalSuccess(peerConnection);
    } catch (e) {
        onSetSessionDescriptionError(e);
    }
};

function onSetRemoteSuccess(pc) {
    console.log(`${getName(pc)} setRemoteDescription complete`);
};

function onSetLocalSuccess(pc) {
    console.log(`${getName(pc)} setLocalDescription complete`);
}

function onSetSessionDescriptionError(error) {
    console.log(`Failed to set session description: ${error.toString()}`);
};

function onAddIceCandidateSuccess() {
    console.log(`peer candidate sent successfully`);
};

function onAddIceCandidateError(pc, error) {
    console.log(`${getName(pc)} failed to add ICE Candidate: ${error.toString()}`);
    isConnectedToSocket = false;
};

function onIceStateChange(pc, event) {
    if (pc) {
        console.log(`${getName(pc)} ICE state: ${pc.iceConnectionState}`);
        console.log('ICE state change event: ', event);
        if (pc.iceConnectionState === 'connected') { isConnectedToPeer = true; }
    }
};

function getName(pc) {
    return (pc === peerConnection) ? 'local peer' : 'remote peer';
};

function getOtherPc(pc) {
    return (pc === peerConnection) ? peerConnection : peerConnection;
};

function handleError(error) {
    if (error.name === 'ConstraintNotSatisfiedError') {
        const v = constraints.video;
        errorMsg(`The resolution ${v.width.exact}x${v.height.exact} px is not supported by your device.`);
    } else if (error.name === 'PermissionDeniedError') {
        errorMsg('Permissions have not been granted to use your camera and ' +
            'microphone, vous devez autorisez la page à acceder à votre matériel');
    }
    errorMsg(`error: ${error.name}`, error);
};

function errorMsg(msg, error) {
    if (typeof error !== 'undefined') {
        console.error(error);
    }
    console.log(msg + error);
};
//data channel methods
async function onDataIceCandidate(pc, socketId, event) {
    try {
        var candidate = event.candidate
        socket.emit("send-dc-candidate", {
            candidate,
            to: socketId
        });
        onAddIceCandidateSuccess();
    } catch (e) {
        onAddIceCandidateError(pc, e);
    }
    console.log(`peer ICE candidate:\n${event.candidate ? event.candidate.candidate : '(null)'}`);
}

function onSendChannelStateChange() {
    console.log("data channel opened")
    readyState = dataChannel.readyState;
    console.log('Send channel state is: ' + readyState);
    if (readyState === 'open') {
        msg.disabled = false;
        msg.focus();
        msgButton.disabled = false;
    } else {
        msg.disabled = true;
        msgButton.disabled = true;
    }
}

function onReceiveMessageCallback(event) {
    console.log('Received Message');
    connecter(connectedToSocket);
    switch (dataType) {
        case 'text':
            afficheMessage(connectedToSocket, event.data);
            break;

        case 'file':
            afficheFichier(connectedToSocket, event.data);
        default:
            break;
    }

    //msg.disabled = false;
    msg.focus();
    msgButton.disabled = false;
    /*
        //if the user is in the box of other peer
    if (readyState === 'open' && isConnectedToSocket === true) {
        afficheMessage(event.data);
    } else {
        //alert the user
        const confirmeMessages = confirm("Nouveau message : " + event.data)
        if (confirmeMessages) {
            afficheMessage(event.data)
        } else {
            return;
        }
    }
    */
};

function onReceiveChannelStateChange() {
    readyState = receivedChannel.readyState;
    console.log(`Receive channel state is: ${readyState}`);
};

function afficheMessage(socketId, data) {
    msgZone.hidden = false;
    messageNumber += 1;
    newMsg = document.createElement('div');
    newMsg.setAttribute("id", messageNumber);
    newMsg.setAttribute("class", "newMsg");
    sender = document.createElement('span');
    sender.setAttribute("class", "message-sender");
    content = document.createElement('span');
    content.innerHTML = data;
    if (socketId === mySocketId) {
        sender.innerHTML = 'Vous';
        newMsg.setAttribute("class", "_2hq0q newMsg localMsg");
        content.setAttribute("class", "local-message-content");
    } else {
        sender.innerHTML = socketId;
        newMsg.setAttribute("class", "_2hq0q newMsg remoteMsg")
        content.setAttribute("class", "remote-message-content");
    }
    newMsg.appendChild(sender);
    newMsg.appendChild(content);
    messages.appendChild(newMsg);
    document.getElementById(messageNumber).focus({ preventScroll: false });
}

function afficheFichier(socketId, data) {
    msgZone.hidden = false;
    messageNumber += 1;
    newMsg = document.createElement('div');
    newMsg.setAttribute("id", messageNumber);
    newMsg.setAttribute("class", "newMsg");
    sender = document.createElement('span');
    sender.setAttribute("class", "message-sender");
    fileName = document.createElement('span');
    fileName.innerHTML = data.name;

    if (socketId === mySocketId) {
        sender.innerHTML = 'Vous';
        newMsg.setAttribute("class", "_2hq0q newMsg localMsg");
        fileName.setAttribute("class", "local-message-content");
        sendProgress = document.createElement('progress');
        sendProgress.setAttribute('id', 'send-progress');
        sendProgress.setAttribute('max', '0');
        sendProgress.setAttribute('value', '0');
        sendProgress.max = data.size;
    } else {
        sender.innerHTML = socketId;
        newMsg.setAttribute("class", "_2hq0q newMsg remoteMsg")
        fileName.setAttribute("class", "remote-message-content");
        receiveProgress = document.createElement('progress');
        receiveProgress.setAttribute('id', 'send-progress');
        receiveProgress.setAttribute('max', '0');
        receiveProgress.setAttribute('value', '0');
        receiveProgress.max = data.size;
    }
    newMsg.appendChild(sender);
    newMsg.appendChild(fileName);
    messages.appendChild(newMsg);
    document.getElementById(messageNumber).focus({ preventScroll: false });
}

function preview(data) {
    selectedFile = data;
    msg.value = selectedFile.name;
}
async function handleFileInputChange() {
    const file = inputf.files[0];
    if (!file) {
        console.log('Erreur, aucun fichier n\'a été choisi');
    } else {
        preview(file);
        msgButton.disabled = false;
        msgButton.focus();
    }
}
//call methods methods
async function onIceCandidate(pc, socketId, event) {
    try {
        var candidate = event.candidate
        socket.emit("send-candidate", {
            candidate,
            to: socketId
        });
        onAddIceCandidateSuccess();
    } catch (e) {
        onAddIceCandidateError(pc, e);
    }
    console.log(`peer ICE candidate:\n${event.candidate ? event.candidate.candidate : '(null)'}`);
}
//diffusion methods
async function onIceCandidate(pc, event) {
    try {
        var candidate = event.candidate
        socket.emit("send-diffusion-candidate", { candidate });
        onAddIceCandidateSuccess();
    } catch (e) {
        onAddIceCandidateError(pc, e);
    }
    console.log(`peer ICE candidate:\n${event.candidate ? event.candidate.candidate : '(null)'}`);
}