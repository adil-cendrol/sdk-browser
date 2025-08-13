class SimpleWhatsAppCallSDK {
  constructor({ apiKey, email, modalContainerId }) {
    this.apiKey = apiKey;
    this.email = email;
    this.ws = null;
    this.peerConnFection = null;
    this.localStream = null;
    this.remoteStream = null;
    // this.modalContainer = document.getElementById(modalContainerId);
    if (modalContainerId) {
      this.modalContainer = document.getElementById(modalContainerId);
    } else {
      // Create a default container if no ID passed
      this.modalContainer = document.createElement('div');
      this.modalContainer.id = 'defaultCallModalContainer';
      document.body.appendChild(this.modalContainer);
    }
    this.initWebSocket();
  }

  initWebSocket() {
    const wsUrl = `wss://464lquf5o3.execute-api.ap-south-1.amazonaws.com/production?apikey=${this.apiKey}&email=${this.email}`;
    this.ws = new WebSocket(wsUrl);
    this.ws.onopen = () => console.log("WS connected");
    this.ws.onmessage = (msg) => this.handleSignalingMessage(JSON.parse(msg.data));
    this.ws.onerror = (err) => console.error("WS error", err);
    this.ws.onclose = () => console.log("WS closed");
  }

  handleSignalingMessage(data) {
    console.log("Received signaling data:", data);
    if (data.sdpType === 'answer') {
      this.setRemoteDescription(data);
    }
    if (data.event === 'terminate') {
      this.closeCall();
    }
  }

  async createOutgoingCall(toNumber, phoneNumberId, businessId) {
    this.showModal(toNumber);
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

      this.peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      this.localStream.getTracks().forEach(track => this.peerConnection.addTrack(track, this.localStream));

      this.peerConnection.onicecandidate = (event) => {
        if (!event.candidate) {
          const offer = this.peerConnection.localDescription;
          if (offer?.type === 'offer') {
            const payload = {
              AgentChatEventType: 'call',
              businessId,
              FromPhoneId: phoneNumberId,
              ToNumber: toNumber,
              sdpType: offer.type,
              sdp: offer.sdp,
              callEvent: 'connect'
            };
            this.ws.send(JSON.stringify(payload));
          }
        }
      };

      this.peerConnection.ontrack = (event) => {
        if (!this.remoteStream) this.remoteStream = new MediaStream();
        this.remoteStream.addTrack(event.track);
        this.playAudio(this.remoteStream);
      };

      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

    } catch (err) {
      console.error('Error starting outgoing call:', err);
    }
  }

  async setRemoteDescription(data) {
    if (!this.peerConnection) return;
    const desc = new RTCSessionDescription({ type: data.sdpType, sdp: data.sdp });
    try {
      await this.peerConnection.setRemoteDescription(desc);
      console.log("Remote SDP set");
    } catch (e) {
      console.error("Failed to set remote SDP", e);
    }
  }

  showModal(subId, {
    expanded = true,
    callStatusText = "Calling",
    callAccepted = false,
    secondsElapsed = 0
  } = {}) {
    if (!this.modalContainer) return;
    this.modalContainer.innerHTML = "";
    const styleTag = document.createElement('style');
    styleTag.innerHTML = `
    .call-modal-container {
      position: fixed;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      width: 320px; background: #fff;
      border-radius: 10px;
      box-shadow: 0 8px 20px rgba(0,0,0,0.2);
      font-family: 'Segoe UI', sans-serif;
      color: #1e5e3e;
      z-index: 9999;
      pointer-events: auto;
      cursor: move;
    }
    .header { display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; border-bottom: 1px solid #ccc; }
    .header h2 { color: #158935; font-size: 14px; font-weight: 500; margin: 0; }
    .close-btn { background: transparent; border: none; font-size: 18px; color: #f0523d; cursor: pointer; }
    .close-btn:hover { color: #c0392b; }
    .caller-info { display: flex; align-items: center; padding: 20px; }
    .caller-info img { width: 38px; height: 38px; border-radius: 50%; }
    .caller-info h3 { margin: 0; font-size: 18px; color: #158935; }
    .caller-info p { margin: 0; font-size: 12px; color: #000; }
    .blinking-dots::after { content: ''; animation: blinkTypingDots 1.5s steps(4, end) infinite; }
    @keyframes blinkTypingDots { 0%{content:'';} 25%{content:'.';} 50%{content:'..';} 75%{content:'...';} 100%{content:'';} }
    .timer { text-align: center; font-size: 12px; color: #000; margin-top: 4px; }
    .call-actions { display: flex; justify-content: center; padding: 20px; }
    .btn.reject { border: 1px solid #EE4823; border-radius: 10px; display: flex; align-items: center; gap: 12px; padding: 8px 14px; cursor: pointer; background: white; }
    .rejectttitle { color: #EE4823; font-size: 14px; }
    .minimized-call { position: fixed; bottom: 3%; left: 50%; transform: translateX(-50%); display: flex; justify-content: space-between; background: #fff; border-radius: 12px; padding: 6px 12px; width: 280px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); cursor: move; }
    .call-left { display: flex; align-items: center; gap: 10px; }
    .caller-info_minimized { display: flex; flex-direction: column; font-size: 14px; }
    .call-timer { font-size: 12px; color: #666; }
  `;
    document.head.appendChild(styleTag);
    const html = expanded ? `
    <div class="call-modal-container" id="draggableModal">
      <div class="header">
        <div style="display:flex;gap:8px;align-items:center;">
          <img src="https://via.placeholder.com/24" alt="call" />
          <h2>Outgoing Call</h2>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <button><img src="https://via.placeholder.com/18" alt="expand" /></button>
          <button class="close-btn" id="closeCallBtn">✕</button>
        </div>
      </div>
      <div class="caller-info">
        <img src="https://via.placeholder.com/38" alt="caller" />
        <div>
          <h3>${callStatusText}<span class="blinking-dots"></span></h3>
          <p>${subId}</p>
        </div>
      </div>
      ${callAccepted ? `<div class="timer">${this.formatTime(secondsElapsed)}</div>` : ""}
      <div class="call-actions">
        <button class="btn reject" id="rejectCallBtn">
          <img src="https://via.placeholder.com/24" alt="reject" />
          <span class="rejectttitle">Reject</span>
        </button>
      </div>
    </div>
  ` : `
    <div class="minimized-call" id="draggableModal">
      <div class="call-left">
        <img src="https://via.placeholder.com/38" alt="caller" />
        <div class="caller-info_minimized">
          <p>${subId}</p>
          ${callAccepted ? `<p class="call-timer">${this.formatTime(secondsElapsed)}</p>` : `<h3>${callStatusText}<span class="blinking-dots"></span></h3>`}
        </div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;">
        <button><img src="https://via.placeholder.com/14" alt="expand" /></button>
        <button class="close-btn" id="closeCallBtn">✕</button>
      </div>
    </div>
  `;

    this.modalContainer.innerHTML = html;
    document.getElementById('closeCallBtn').onclick = () => this.closeCall();
    const rejectBtn = document.getElementById('rejectCallBtn');
    if (rejectBtn) rejectBtn.onclick = () => this.closeCall();
    this.makeModalDraggable(document.getElementById('draggableModal'));
  }

  makeModalDraggable(modal) {
    let isDragging = false, offsetX = 0, offsetY = 0;
    modal.addEventListener('mousedown', (e) => {
      isDragging = true;
      offsetX = e.clientX - modal.getBoundingClientRect().left;
      offsetY = e.clientY - modal.getBoundingClientRect().top;
    });
    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      modal.style.left = e.clientX - offsetX + 'px';
      modal.style.top = e.clientY - offsetY + 'px';
      modal.style.transform = 'none';
    });
    document.addEventListener('mouseup', () => isDragging = false);
  }
  formatTime(secs) {
    const minutes = Math.floor(secs / 60)
      .toString()
      .padStart(2, "0");
    const secondsPart = (secs % 60).toString().padStart(2, "0");
    return `${minutes}:${secondsPart}`;
  }


  closeCall() {
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop());
      this.localStream = null;
    }
    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach(t => t.stop());
      this.remoteStream = null;
    }
    if (this.modalContainer) this.modalContainer.innerHTML = '';
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ event: "terminate" }));
    }
  }

  playAudio(stream) {
    const audioElem = document.createElement('audio');
    audioElem.srcObject = stream;
    audioElem.autoplay = true;
    audioElem.controls = false;
    audioElem.style.display = 'none';
    document.body.appendChild(audioElem);
  }
}
