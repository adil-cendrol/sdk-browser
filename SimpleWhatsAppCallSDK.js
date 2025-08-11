class SimpleWhatsAppCallSDK {
  constructor(apiKey, modalContainerId) {
    this.apiKey = apiKey;
    this.ws = null;
    this.peerConnFection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.modalContainer = document.getElementById(modalContainerId);
    this.initWebSocket();
  }

  initWebSocket() {
    // Example WebSocket URL
    const wsUrl = `wss://464lquf5o3.execute-api.ap-south-1.amazonaws.com/production?apikey=14a565f323e44a7e87c2ad988d44c2a2&email=watest1@gmail.com`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => console.log("WS connected");
    this.ws.onmessage = (msg) => this.handleSignalingMessage(JSON.parse(msg.data));
    this.ws.onerror = (err) => console.error("WS error", err);
    this.ws.onclose = () => console.log("WS closed");
  }

  handleSignalingMessage(data) {
    console.log("Received signaling data:", data);
    // You may handle 'answer', 'cancel', 'terminate' etc here
    if(data.sdpType === 'answer') {
      this.setRemoteDescription(data);
    }
    if(data.event === 'cancel' || data.event === 'terminate') {
      this.closeCall();
    }
  }

  async createOutgoingCall(toNumber, phoneNumberId, businessId) {
    this.showModal(); // Show popup on outgoing call start

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

  showModal() {
    if (!this.modalContainer) return;

    // Simple popup with close button and call info
    this.modalContainer.innerHTML = `
      <div style="position:fixed;top:20%;left:50%;transform:translateX(-50%);
                  background:#fff;padding:20px;box-shadow:0 0 10px rgba(0,0,0,0.3);
                  z-index:1000; max-width:300px; border-radius:8px;">
        <h3>Calling...</h3>
        <button id="closeCallBtn">Hang Up</button>
      </div>
    `;

    document.getElementById('closeCallBtn').onclick = () => this.closeCall();
  }

  closeCall() {
    // Close peer connection, stop tracks, close modal
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
