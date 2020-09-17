const messages = document.getElementById('messages');
const msg = document.getElementById('msg');
const msgButton = document.getElementById('msgButton');
const msgZone = document.getElementById('msg-zone');
const diffusion = document.getElementById('diffusion');
const diff = document.getElementById('diff');
const screen = document.getElementById('screen-share');
const start = document.getElementById('start');
const action = document.getElementById('action-zone');
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const constraints = {
    audio: true,
    video: true
}
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
let mySocketId; //indique le socket id du client
let connectToSocket; //indique le socket auquel on veut se connecter
let connectedToSocket; //indique le socket auquel on est connecté
let dataChannel;
let receivedChannel;
let messageNumber = 0;
let readyState;
let offer;
let answer;
let stream;
let mediaSource = 'user';

//operations
function sendData() {
    const data = msg.value;
    dataChannel.send(data);
    afficheMessage(mySocketId, data);
    console.log('Sent Data: ' + data);
    msg.value = ''
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
        localVideo.hidden = false;
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
    //gotStream(mediaSource);
    stream = await navigator.mediaDevices.getUserMedia(constraints);
    console.log('Accès au flux media');
    for (const track of stream.getTracks()) {
        peerConnection.addTrack(track, stream);
    };
    localVideo.hidden = false;
    localVideo.srcObject = stream;
    localStream = stream;
    remoteVideo.hidden = false;

    //send candidate to other peer
    peerConnection.addEventListener('icecandidate', e => onIceCandidate(peerConnection, socketId, e));
    peerConnection.addEventListener('iceconnectionstatechange', e => onIceStateChange(peerConnection, e));

    // create offer, set local description and offer
    offer = await peerConnection.createOffer(offerOptions)
    await onCreateOfferSuccess(offer)
    socket.emit("make-offer", {
        offer,
        to: socketId
    });
}

async function connecter(socketId) {
    diff.hidden = true;
    const talkingWithInfo = document.getElementById("talking-with-info");
    talkingWithInfo.innerHTML = `Vous êtes connecté avec ${socketId}"`;
    action.hidden = false
        //afficher les appels à action
    msgZone.hidden = false
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
start.addEventListener('click', function() {
    //ecrire(connectToSocket)
    alert("Bonjour !");
});
msg.addEventListener('click', function() {
    ecrire(connectToSocket);
})
screen.addEventListener("click", function() {
    /*
    mediaSource = 'screen';
    call(connectToSocket, mediaSource);
    callButton.innerHTML = 'Revenir à la caméra';
    */
})
callButton.addEventListener("click", function() {
    call(connectToSocket);
});
msgButton.addEventListener("click", function() {
    sendData()
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
    console.log("call offer received")
    connectedToSocket = data.socket;
    remoteVideo.hidden = false
    localVideo.hidden = false
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
    /*
    //emettre aussi un appel
    try {
        call(data.socket)
    } catch (error) {
        handleError(error)
    }
    */
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
socket.on("your-id"), data => {
    mySocketId = data.user;
}
socket.on("update-user-list", ({ users }) => {
    updateUserList(users);
});
socket.on("remove-user", ({ socketId }) => {
    const elToRemove = document.getElementById(socketId);

    if (elToRemove) {
        elToRemove.remove();
    }
});

//methods definitions
function unselectUsersFromList() {
    const alreadySelectedUser = document.querySelectorAll(
        ".active-user.active-user--selected"
    );

    alreadySelectedUser.forEach(el => {
        el.setAttribute("class", "active-user");
    });
};

function updateUserList(socketIds) {
    const activeUserContainer = document.getElementById("active-user-container");

    socketIds.forEach(socketId => {
        const alreadyExistingUser = document.getElementById(socketId);
        if (!alreadyExistingUser) {
            const userContainerEl = createUserItemContainer(socketId);
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
    afficheMessage(connectedToSocket, event.data);
    msg.disabled = false;
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
    newMsg.setAttribute("class", "panel");
    sender = document.createElement('p');
    sender.setAttribute("class", "message-sender");
    if (socketId === mySocketId) {
        sender.innerHTML = 'Vous';
    } else {
        sender.innerHTML = socketId;
    }
    content = document.createElement('p');
    content.setAttribute("class", "message-content");
    content.innerHTML = data;
    newMsg.appendChild(sender);
    newMsg.appendChild(content);
    messages.appendChild(newMsg);
    document.getElementById(messageNumber).focus({ preventScroll: false });
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