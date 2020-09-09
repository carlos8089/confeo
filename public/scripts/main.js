let msg = document.getElementById('msg').value;
let msgButton = document.getElementById('msgButton');

const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');

const constraints = {
    audio: true,
    video: {
        width: { min: 360, max: 1080 },
        height: { min: 240, max: 720 }
    }
}

const offerOptions = {
    offerToReceiveAudio: 1,
    offerToReceiveVideo: 1
};

const iceConfig = { iceServers: [] }

const peerConnection = new RTCPeerConnection(iceConfig);
let offer;
let answer;
let stream;

function unselectUsersFromList() {
    const alreadySelectedUser = document.querySelectorAll(
        ".active-user.active-user--selected"
    );

    alreadySelectedUser.forEach(el => {
        el.setAttribute("class", "active-user");
    });
}

function updateUserList(socketIds) {
    const activeUserContainer = document.getElementById("active-user-container");

    socketIds.forEach(socketId => {
        const alreadyExistingUser = document.getElementById(socketId);
        if (!alreadyExistingUser) {
            const userContainerEl = createUserItemContainer(socketId);
            activeUserContainer.appendChild(userContainerEl);
        }
    });
}

function createUserItemContainer(socketId) {
    const userContainerEl = document.createElement("div");

    const usernameEl = document.createElement("p");

    userContainerEl.setAttribute("class", "active-user");
    userContainerEl.setAttribute("id", socketId);
    usernameEl.setAttribute("class", "username");
    usernameEl.innerHTML = `${socketId}`;

    userContainerEl.appendChild(usernameEl);

    userContainerEl.addEventListener("click", () => {
        unselectUsersFromList();
        userContainerEl.setAttribute("class", "active-user active-user--selected");
        connecter(socketId);
    });
    return userContainerEl;
}
async function onCreateOfferSuccess(desc) {
    console.log(`Offer from local peer\n${desc.sdp}`);
    console.log('local peer setLocalDescription start');
    try {
        await peerConnection.setLocalDescription(desc);
        onSetLocalSuccess(peerConnection);
    } catch (e) {
        onSetSessionDescriptionError(e);
    }
}
async function onCreateAnswerSuccess(desc) {
    console.log(`Answer from remote peer end point:\n${desc.sdp}`);
    console.log('remote peer setLocalDescription start');
    try {
        await peerConnection.setLocalDescription(desc);
        onSetLocalSuccess(peerConnection);
    } catch (e) {
        onSetSessionDescriptionError(e);
    }
}

function onSetRemoteSuccess(pc) {
    console.log(`${getName(pc)} setRemoteDescription complete`);
}

function onSetLocalSuccess(pc) {
    console.log(`${getName(pc)} setLocalDescription complete`);
}

function onSetSessionDescriptionError(error) {
    console.log(`Failed to set session description: ${error.toString()}`);
}
async function onIceCandidate(pc, socketId, event) {
    try {
        var candidate = event.candidate
        socket.emit("send-candidate", {
            candidate,
            to: socketId
        });
        /*
        await (getOtherPc(pc).addIceCandidate(event.candidate));
        */
        onAddIceCandidateSuccess();
    } catch (e) {
        onAddIceCandidateError(pc, e);
    }
    console.log(`peer ICE candidate:\n${event.candidate ? event.candidate.candidate : '(null)'}`);
}

function onAddIceCandidateSuccess() {
    console.log(`peer candidate sent successfully`);
}

function onAddIceCandidateError(pc, error) {
    console.log(`${getName(pc)} failed to add ICE Candidate: ${error.toString()}`);
}

function onIceStateChange(pc, event) {
    if (pc) {
        console.log(`${getName(pc)} ICE state: ${pc.iceConnectionState}`);
        console.log('ICE state change event: ', event);
    }
}

function onIceStateChange(pc, event) {
    if (pc) {
        console.log(`${getName(pc)} ICE state: ${pc.iceConnectionState}`);
        console.log('ICE state change event: ', event);
    }
}

function getName(pc) {
    return (pc === peerConnection) ? 'local peer' : 'remote peer';
}

function getOtherPc(pc) {
    return (pc === peerConnection) ? peerConnection : peerConnection;
}

async function connecter(socketId) {
    console.log("peer end point created")
    try {
        offer = await peerConnection.createOffer(offerOptions)
        console.log("offer created: " + offer)
        await onCreateOfferSuccess(offer)
        peerConnection.addEventListener('icecandidate', e => onIceCandidate(peerConnection, socketId, e));
        peerConnection.addEventListener('iceconnectionstatechange', e => onIceStateChange(peerConnection, e));
        socket.emit("make-offer", {
            offer,
            to: socketId
        });
    } catch (error) {
        handleError(error)
    }

    //créer les appels à action
    try {
        //console.log(socketId);
        const talkingWithInfo = document.getElementById("talking-with-info");
        talkingWithInfo.innerHTML = `Vous êtes connecté avec ${socketId}"`;
        const callButton = document.createElement('button')
        callButton.setAttribute("id", "callButton")
        callButton.setAttribute("class", "btn btn-primary")
        callButton.innerHTML = 'Appeler';
        document.getElementById('callButton-zone').appendChild(callButton);
    } catch (error) {
        handleError(error);
    }
    // appeler un utilisateur
    callButton.addEventListener("click", async function() {
        try {
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            console.log('Accès au flux media');
            for (const track of stream.getTracks()) {
                peerConnection.addTrack(track, stream);
            }
            localVideo.srcObject = stream;
            localStream = stream;
            localVideo.play();
        } catch (err) {
            handleError(err);
        }
    })
}
peerConnection.ontrack = ({ track, streams }) => {
    // once media for a remote track arrives, show it in the remote video element
    track.onunmute = () => {
        // don't set srcObject again if it is already set.
        if (remoteVideo.srcObject) return;
        remoteVideo.srcObject = streams[0];
    };
};
msgButton.addEventListener("click", function(send) {
    socket.emit("msg", {
        msg,
        to: socketId
    });
});

const socket = io();
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
    console.log("offre reçu")
    peerConnection.addEventListener('icecandidate', e => onIceCandidate(peerConnection, data.socket, e))

    console.log("setRemoteDescription start")
    await peerConnection.setRemoteDescription(data.offer)
    await onSetRemoteSuccess(peerConnection)

    try {
        console.log("peer createAnswer start")
        answer = await peerConnection.createAnswer()
        await onCreateAnswerSuccess(answer)

        socket.emit("make-answer", {
            answer,
            to: data.socket
        });

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
})
socket.on("update-user-list", ({ users }) => {
    updateUserList(users);
});

socket.on("remove-user", ({ socketId }) => {
    const elToRemove = document.getElementById(socketId);

    if (elToRemove) {
        elToRemove.remove();
    }
});

function handleError(error) {
    if (error.name === 'ConstraintNotSatisfiedError') {
        const v = constraints.video;
        errorMsg(`The resolution ${v.width.exact}x${v.height.exact} px is not supported by your device.`);
    } else if (error.name === 'PermissionDeniedError') {
        errorMsg('Permissions have not been granted to use your camera and ' +
            'microphone, vous devez autorisez la page à acceder à votre matériel');
    }
    errorMsg(`error: ${error.name}`, error);
}

function errorMsg(msg, error) {
    if (typeof error !== 'undefined') {
        console.error(error);
    }
    console.log(msg + error);
}