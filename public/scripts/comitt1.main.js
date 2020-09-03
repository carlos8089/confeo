/*
 *  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
'use strict';

// Put variables in global scope to make them available to the browser console.
const constraints = window.constraints = {
    audio: false,
    video: true
};

function handleSuccess(stream) {
    const leftVideo = document.querySelector('#leftVideo');
    const videoTracks = stream.getVideoTracks();
    console.log('Got stream with constraints:', constraints);
    console.log(`Using video device: ${videoTracks[0].label}`);
    window.leftVideo.stream = stream; // make variable available to browser console
    leftVideo.srcObject = stream;
    // leftVideo.play() n'est pas une fonction
}

function handleError(error) {
    if (error.name === 'ConstraintNotSatisfiedError') {
        const v = constraints.video;
        errorMsg(`The resolution ${v.width.exact}x${v.height.exact} px is not supported by your device.`);
    } else if (error.name === 'PermissionDeniedError') {
        errorMsg('Permissions have not been granted to use your camera and ' +
            'microphone, vous devez autorisez la page à acceder à votre matériel');
    }
    errorMsg(`getUserMedia error: ${error.name}`, error);
}

function errorMsg(msg, error) {
    const errorElement = document.querySelector('#errorMsg');
    errorElement.innerHTML += `<p>${msg}</p>`;
    if (typeof error !== 'undefined') {
        console.error(error);
    }
}

async function init(e) {
    try {
        const Mstream = await navigator.mediaDevices.getUserMedia(constraints);
        handleSuccess(Mstream);
        e.target.disabled = true;
    } catch (e) {
        handleError(e);
    }
}

document.querySelector('#start').addEventListener('click', e => init(e));